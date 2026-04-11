# VigiByte Backend Containerization
# Purpose: Sets up a stable Python environment for the AI recognition engine.
# Using python 3.10-slim to balance between features and final image size.
FROM python:3.10-slim

# Install essential system-level dependencies for dlib and face_recognition.
# These libraries (cmake, build-essential) are required to compile C++ code into Python.
# Mathematical libraries like OpenBLAS and Lapack ensure faster matrix calculations.
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    && rm -rf /var/lib/apt/lists/* # Optimized step: Clears cache to reduce image size

# Define the working directory inside the container
WORKDIR /app

# Copy the Python dependency list first for efficient Docker layer caching
COPY requirements.txt .

# Install Python packages (FastAPI, uvicorn, face_recognition, etc.)
RUN pip install --no-cache-dir -r requirements.txt

# Transfer the main FastAPI application logic into the container
COPY main.py .

# Document that the backend service listens on port 8001
EXPOSE 8001

# Execute the application using Uvicorn. 
# Binding to 0.0.0.0 ensures the service is accessible outside the container.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]