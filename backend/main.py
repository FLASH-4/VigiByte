"""
VIGIBYTE: OPTIMIZED AI RECOGNITION ENGINE
Purpose: Resource-efficient backend optimized for low-memory environments (Cloud Free Tiers).
Optimization Strategy:
 - Model: Facenet (128-D) - Significant reduction in RAM footprint compared to 512-D.
 - Detector: OpenCV - Lightweight, built-in detection without heavy weight downloads.
 - Logic: Vectorized Cosine Similarity for rapid multi-face matching.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from deepface import DeepFace
import numpy as np
import base64
import io
import logging
from PIL import Image

# System monitoring setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VigiByte Face Recognition API", version="2.1.0")

# Security: Enable Cross-Origin Resource Sharing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# RESOURCE-EFFICIENT CONFIGURATION
# Best balance of speed and accuracy for environments with < 512MB RAM.
MODEL_NAME = "Facenet"
DETECTOR = "opencv"

class DetectRequest(BaseModel):
    frame_base64: str
    criminals: list
    threshold: float = 0.6 # Slightly higher threshold for 128-D accuracy

class DescriptorRequest(BaseModel):
    image_base64: str

# --- DATA TRANSFORMATION HELPERS ---

def decode_to_np(base64_str: str) -> np.ndarray:
    """Efficiently decodes Base64 to a NumPy array for inference."""
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    img_bytes = base64.b64decode(base64_str)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return np.array(img)

# --- SYSTEM ENDPOINTS ---

@app.get("/")
def root():
    return {"status": "ok", "service": "VigiByte API"}

@app.get("/health")
def health():
    """Returns the current operational status and active AI models."""
    return {"status": "ok", "model": f"DeepFace ({MODEL_NAME} + {DETECTOR})"}

@app.post("/get-descriptor")
def get_descriptor(req: DescriptorRequest):
    """
    ENROLLMENT ENGINE
    Extracts 128-dimensional facial embeddings. 
    Smaller vector size ensures faster DB lookups and lower memory usage.
    """
    try:
        img = decode_to_np(req.image_base64)
        embeddings = DeepFace.represent(
            img_path=img,
            model_name=MODEL_NAME,
            detector_backend=DETECTOR,
            enforce_detection=True
        )
        if not embeddings:
            raise HTTPException(status_code=400, detail="No face detected in image")
        if len(embeddings) > 1:
            raise HTTPException(status_code=400, detail=f"{len(embeddings)} faces detected — use photo with 1 person only")
        
        return {
            "success": True, 
            "descriptor": embeddings[0]["embedding"], 
            "face_count": len(embeddings)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get-descriptor error: {e}")
        raise HTTPException(status_code=400, detail="No face detected or image error")

@app.post("/detect")
async def detect(req: DetectRequest):
    """
    REAL-TIME INFERENCE ENGINE
    Optimized for multi-face detection and vectorized matching.
    """
    try:
        img = decode_to_np(req.frame_base64)
        
        # Face Localization Stage
        try:
            detections = DeepFace.represent(
                img_path=img,
                model_name=MODEL_NAME,
                detector_backend=DETECTOR,
                enforce_detection=True
            )
        except Exception:
            return {"matches": [], "face_count": 0}

        if not detections:
            return {"matches": [], "face_count": 0}

        # Biometric Matching Stage
        known_encodings = []
        valid_criminals = []
        for criminal in req.criminals:
            desc = criminal.get("face_descriptor")
            if not desc:
                continue
            known_encodings.append(np.array(desc, dtype=np.float64))
            valid_criminals.append(criminal)

        if not known_encodings:
            return {"matches": [], "face_count": len(detections)}

        matches = []
        known_arr = np.array(known_encodings)

        for det in detections:
            query = np.array(det["embedding"], dtype=np.float64)
            
            # VECTORIZED COSINE SIMILARITY
            # High-speed calculation to find the closest biometric match in the registry.
            norms = np.linalg.norm(known_arr, axis=1) * np.linalg.norm(query)
            norms = np.where(norms == 0, 1e-10, norms)
            similarities = np.dot(known_arr, query) / norms
            
            best_idx = int(np.argmax(similarities))
            best_sim = float(similarities[best_idx])

            # Validation based on the optimized threshold
            if best_sim >= req.threshold:
                criminal = valid_criminals[best_idx]
                facial_area = det.get("facial_area", {})
                matches.append({
                    "id": criminal["id"],
                    "name": criminal["name"],
                    "confidence": round(best_sim * 100),
                    "boundingBox": {
                        "x": facial_area.get("x", 0),
                        "y": facial_area.get("y", 0),
                        "width": facial_area.get("w", 100),
                        "height": facial_area.get("h", 100)
                    },
                    # Merge additional criminal metadata
                    **{k: v for k, v in criminal.items() if k != "face_descriptor"}
                })

        logger.info(f"Frame Processed: {len(detections)} faces found, {len(matches)} identified.")
        return {"matches": matches, "face_count": len(detections)}

    except Exception as e:
        logger.error(f"Detection Engine Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))