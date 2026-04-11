"""
VIGIBYTE: AI RECOGNITION ENGINE (CORE BACKEND)
Purpose: High-performance Python backend providing forensic-grade face recognition.
AI Stack: 
 - Framework: FastAPI (Asynchronous API)
 - Detection Backend: RetinaFace (Optimal for non-frontal/angled faces)
 - Recognition Model: Facenet512 (Generates high-dimensional 512-D embeddings)
 - Similarity Metric: Cosine Similarity for vector comparison
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from deepface import DeepFace
import numpy as np
import base64
import os
import io
import logging
from PIL import Image

# Setup logging for system monitoring
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VigiByte Face Recognition API", version="2.0.0")

# Security: Enable Cross-Origin Resource Sharing for the React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AI HYPERPARAMETERS
# Facenet512 provides a 512-dimensional vector which is highly robust for large databases.
MODEL_NAME = "Facenet512"
DETECTOR = "retinaface" # State-of-the-art detector for surveillance environments

class DetectRequest(BaseModel):
    frame_base64: str
    criminals: list
    threshold: float = 0.5

class DescriptorRequest(BaseModel):
    image_base64: str

# --- IMAGE PRE-PROCESSING HELPERS ---

def decode_to_pil(base64_str: str) -> Image.Image:
    """Decodes incoming Base64 stream from React into a PIL image."""
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    img_bytes = base64.b64decode(base64_str)
    return Image.open(io.BytesIO(img_bytes)).convert("RGB")

def pil_to_np(img: Image.Image) -> np.ndarray:
    """Converts PIL object to NumPy array for deep learning inference."""
    return np.array(img)

# --- SYSTEM ENDPOINTS ---

@app.get("/health")
def health():
    """System health check and model status."""
    return {"status": "ok", "model": f"DeepFace ({MODEL_NAME} + {DETECTOR})"}


@app.post("/get-descriptor")
def get_descriptor(req: DescriptorRequest):
    """
    BIOMETRIC ENROLLMENT
    Extracts a facial embedding (128/512-D vector) for storage in Supabase.
    This serves as the 'Digital Fingerprint' of the face.
    """
    try:
        img = pil_to_np(decode_to_pil(req.image_base64))

        # Perform feature extraction using Facenet
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
            "descriptor": embeddings[0]["embedding"], # The mathematical representation of the face
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
    REAL-TIME SURVEILLANCE INFERENCE
    1. Detects all faces in the incoming video frame.
    2. Compares each face against the provided criminal database using Cosine Similarity.
    3. Returns matches with confidence scores and bounding box coordinates.
    """
    try:
        img = pil_to_np(decode_to_pil(req.frame_base64))

        # Detection Stage: Locate all faces in the frame
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

        # Recognition Stage: Vectorized comparison logic
        known_embeddings = []
        valid_criminals = []
        for criminal in req.criminals:
            desc = criminal.get("face_descriptor")
            if not desc:
                continue
            known_embeddings.append(np.array(desc, dtype=np.float64))
            valid_criminals.append(criminal)

        if not known_embeddings:
            return {"matches": [], "face_count": len(detections)}

        matches = []
        known_arr = np.array(known_embeddings)

        for det in detections:
            query = np.array(det["embedding"], dtype=np.float64)

            # MATHEMATICAL SCORING: Cosine Similarity
            # Formula: (A dot B) / (||A|| * ||B||)
            # Measures the angular distance between the face in the video vs. the database.
            norms = np.linalg.norm(known_arr, axis=1) * np.linalg.norm(query)
            norms = np.where(norms == 0, 1e-10, norms)
            similarities = np.dot(known_arr, query) / norms

            best_idx = int(np.argmax(similarities))
            best_sim = float(similarities[best_idx])

            # Validation: 0.5 is a highly reliable threshold for Facenet512
            if best_sim >= req.threshold:
                criminal = valid_criminals[best_idx]
                confidence = round(best_sim * 100)

                # Extract geometric data for frontend visualization
                facial_area = det.get("facial_area", {})
                box = {
                    "x": facial_area.get("x", 0),
                    "y": facial_area.get("y", 0),
                    "width": facial_area.get("w", 100),
                    "height": facial_area.get("h", 100)
                }

                matches.append({
                    "id": criminal["id"],
                    "name": criminal["name"],
                    "confidence": confidence,
                    "boundingBox": box,
                    **{k: v for k, v in criminal.items() if k != "face_descriptor"}
                })

        logger.info(f"Analysis Complete: {len(detections)} face(s), {len(matches)} positive match(es)")
        return {"matches": matches, "face_count": len(detections)}

    except Exception as e:
        logger.error(f"Inference Engine Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))