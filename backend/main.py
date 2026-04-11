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

# --- LOGGING & HARDWARE CONFIGURATION ---
# Initialize logging to track system behavior and errors.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check if CUDA (GPU) is available for dlib; determines if CNN or HOG should be preferred.
USE_CNN = dlib.DLIB_USE_CUDA

app = FastAPI(title="VigiByte Face Recognition API", version="1.0.0")

# --- MIDDLEWARE CONFIGURATION ---
# Enabling CORS for cross-origin communication between React frontend and FastAPI.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production Note: Restrict this to specific domain for security.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA MODELS (PYDANTIC) ---
# Defining strict schemas for API request bodies.

class EnrollRequest(BaseModel):
    """Schema for adding a new subject to the database."""
    criminal_id: str
    name: str
    image_base64: str  # Encoded image string from the client.

class DetectRequest(BaseModel):
    """Schema for real-time detection requests sent from the video feed."""
    frame_base64: str           # The current video frame being analyzed.
    criminals: list             # Registry of known suspects: [{ id, name, face_descriptor }]
    threshold: float = 0.5     # Tolerance for matching (Lower = stricter).

class DescriptorRequest(BaseModel):
    """Schema for direct vector extraction from a single image."""
    image_base64: str

# --- HELPER FUNCTIONS ---

def decode_image(base64_str: str):
    """
    Decodes a Base64 string into a NumPy array for AI processing.
    Handles data URI prefixes and performs RGB conversion.
    """
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
        
        img_bytes = base64.b64decode(base64_str)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        
        # Explicit conversion to ensure memory is allocated correctly as a uint8 array.
        return np.array(img, dtype=np.uint8)
    except Exception as e:
        logger.error(f"Image Decoding Error: {e}")
        raise HTTPException(status_code=400, detail="Corrupted Image Data")

def get_face_encodings(img_array: np.ndarray) -> list:
    """
    Extracts 128-dimensional face encodings.
    Prioritizes the CNN model for better tilt and angle detection.
    Falls back to HOG if no faces are found or hardware is limited.
    """
    # Logic: CNN is robust for surveillance; HOG is faster for CPU-bound tasks.
    model_to_use = "cnn" if USE_CNN else "hog"
    
    # number_of_times_to_upsample=1 increases detection chance for smaller faces.
    locations = face_recognition.face_locations(img_array, model=model_to_use, number_of_times_to_upsample=1)
    
    if not locations:
        # Secondary attempt using the standard HOG model if the primary fails.
        locations = face_recognition.face_locations(img_array, model="hog", number_of_times_to_upsample=1)
    
    if not locations:
        return [], []
    
    # Generate the 128-float mathematical representation of the face.
    encodings = face_recognition.face_encodings(img_array, locations)
    return encodings, locations

# --- API ROUTES ---

@app.get("/health")
async def health():
    """System heartbeat endpoint to verify API and AI model status."""
    print("🔔 Health check request received!")
    return {"status": "ok", "model": "face_recognition (dlib CNN)"}


@app.post("/get-descriptor")
def get_descriptor(req: DescriptorRequest):
    """
    Utility to extract a face descriptor during subject enrollment.
    This vector is stored in the database for future comparison.
    """
    try:
        img = decode_image(req.image_base64)
        encodings, locations = get_face_encodings(img)

        if not encodings:
            raise HTTPException(status_code=400, detail="No face detected in image")
        
        if len(encodings) > 1:
            # Policy: Prevent enrollment if multiple faces are present to avoid data pollution.
            raise HTTPException(status_code=400, detail=f"{len(encodings)} faces detected — please use a photo with only 1 person")

        return {
            "success": True,
            "descriptor": encodings[0].tolist(),  # Converting NumPy array to list for JSON response.
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
    Main identification engine. Matches detected faces in a frame against the known registry.
    Calculates confidence scores based on Euclidean distance.
    """
    try:
        img = decode_image(req.frame_base64)
        encodings, locations = get_face_encodings(img)

        # Early exit if no humans are found in the frame.
        if not encodings:
            return {"matches": [], "face_count": 0}

        # Convert suspect registry lists into optimized NumPy arrays for fast matrix comparison.
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

        # Iterating through every face found in the current frame.
        for encoding, location in zip(encodings, locations):
            # Calculate mathematical distance (Lower distance = Higher similarity).
            distances = face_recognition.face_distance(known_encodings, encoding)
            best_idx = int(np.argmin(distances))
            best_distance = float(distances[best_idx])

            # Filter results based on the provided threshold.
            if best_distance <= req.threshold:
                criminal = valid_criminals[best_idx]
                # Mapping distance to a human-readable percentage score.
                confidence = round((1 - best_distance) * 100)

                # Convert coordinates to a standardized bounding box format.
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
                    # Merge all other metadata fields for frontend alert displays.
                    **{k: v for k, v in criminal.items() if k not in ["face_descriptor"]}
                })

        logger.info(f"Detected {len(encodings)} face(s), {len(matches)} match(es)")
        return {"matches": matches, "face_count": len(encodings)}

    except Exception as e:
        logger.error(f"detect error: {e}")
        raise HTTPException(status_code=500, detail=str(e))