from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import face_recognition
import numpy as np
import base64
import os
from PIL import Image
import dlib
import io
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
USE_CNN = dlib.DLIB_USE_CUDA

app = FastAPI(title="VigiByte Face Recognition API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production: set to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ────────────────────────────────────────────────────────────────────

class EnrollRequest(BaseModel):
    criminal_id: str
    name: str
    image_base64: str  # base64 encoded image

class DetectRequest(BaseModel):
    frame_base64: str           # base64 encoded video frame
    criminals: list             # [{ id, name, face_descriptor: [128 floats] }]
    threshold: float = 0.5     # lower = stricter match

class DescriptorRequest(BaseModel):
    image_base64: str

# ── Helpers ───────────────────────────────────────────────────────────────────

# main.py mein decode_image
def decode_image(base64_str: str):
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
        
        img_bytes = base64.b64decode(base64_str)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        
        # Memory release karne ke liye explicitly array conversion
        return np.array(img, dtype=np.uint8)
    except Exception as e:
        logger.error(f"Memory Error during decoding: {e}")
        raise HTTPException(status_code=400, detail="Corrupted Image Data")

def get_face_encodings(img_array: np.ndarray) -> list:
    """Get 128-d face encodings. Uses CNN model for better angle detection."""
    # 'cnn' model handles tilted/angled faces much better than 'hog'
    # number_of_times_to_upsample=1 catches smaller faces too
    model_to_use = "cnn" if USE_CNN else "hog"
    locations = face_recognition.face_locations(img_array, model=model_to_use, number_of_times_to_upsample=1)
    if not locations:
        # Fallback to hog if cnn finds nothing
        locations = face_recognition.face_locations(img_array, model="hog", number_of_times_to_upsample=1)
    
    if not locations:
        return [], []
    
    encodings = face_recognition.face_encodings(img_array, locations)
    return encodings, locations

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    print("🔔 Health check request received!")
    return {"status": "ok", "model": "face_recognition (dlib CNN)"}


@app.post("/get-descriptor")
def get_descriptor(req: DescriptorRequest):
    """
    Extract 128-d face descriptor from an image.
    Call this when enrolling a criminal in CriminalDB.
    Returns the descriptor to store in Supabase face_descriptor column.
    """
    try:
        img = decode_image(req.image_base64)
        encodings, locations = get_face_encodings(img)

        if not encodings:
            raise HTTPException(status_code=400, detail="No face detected in image")
        
        if len(encodings) > 1:
            raise HTTPException(status_code=400, detail=f"{len(encodings)} faces detected — please use a photo with only 1 person")

        return {
            "success": True,
            "descriptor": encodings[0].tolist(),  # 128 floats
            "face_count": len(encodings)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get-descriptor error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/detect")
async def detect(req: DetectRequest):
    """
    Detect faces in a video frame and match against criminal database.
    Called every ~400ms from CameraFeed.jsx
    
    Returns list of matches with confidence score and bounding box.
    """
    try:
        img = decode_image(req.frame_base64)
        encodings, locations = get_face_encodings(img)

        if not encodings:
            return {"matches": [], "face_count": 0}

        # Build known encodings from criminals list
        known_encodings = []
        valid_criminals = []
        
        for criminal in req.criminals:
            desc = criminal.get("face_descriptor")
            if not desc:
                continue
            known_encodings.append(np.array(desc, dtype=np.float64))
            valid_criminals.append(criminal)

        if not known_encodings:
            return {"matches": [], "face_count": len(encodings)}

        matches = []
        img_height, img_width = img.shape[:2]

        for encoding, location in zip(encodings, locations):
            # Compare this face against all criminals
            distances = face_recognition.face_distance(known_encodings, encoding)
            best_idx = int(np.argmin(distances))
            best_distance = float(distances[best_idx])

            if best_distance <= req.threshold:
                criminal = valid_criminals[best_idx]
                confidence = round((1 - best_distance) * 100)

                # face_recognition returns (top, right, bottom, left)
                top, right, bottom, left = location
                matches.append({
                    "id": criminal["id"],
                    "name": criminal["name"],
                    "confidence": confidence,
                    "distance": best_distance,
                    "boundingBox": {
                        "x": left,
                        "y": top,
                        "width": right - left,
                        "height": bottom - top
                    },
                    # Pass through all criminal fields for alerts
                    **{k: v for k, v in criminal.items() if k not in ["face_descriptor"]}
                })

        logger.info(f"Detected {len(encodings)} face(s), {len(matches)} match(es)")
        return {"matches": matches, "face_count": len(encodings)}

    except Exception as e:
        logger.error(f"detect error: {e}")
        raise HTTPException(status_code=500, detail=str(e))