# --- VIGIBYTE AI ENGINE: DOCKER CONFIGURATION ---
# Base Image: Using python:3.10-slim for a minimal footprint and reduced attack surface.
FROM python:3.10-slim

# SYSTEM-LEVEL DEPENDENCIES
# libgl1 is added specifically for OpenCV/DeepFace graphics processing.
# Using --no-install-recommends and cleaning apt-lists to ensure a lean production image.
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Setting the working directory
WORKDIR /app

# DEPENDENCY MANAGEMENT
# Copying requirements first to utilize Docker Layer Caching (speeds up re-builds).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# INJECTING SOURCE CODE
# Copy the FastAPI application logic (Brain of VigiByte).
COPY main.py .

# NETWORK MAPPING
# Exposing port 8001 for high-speed AI inference requests.
EXPOSE 8001

# ENTRYPOINT
# Running Uvicorn on 0.0.0.0 to enable communication within the Docker network.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860", "--root-path", "/"]