# --- VIGIBYTE AI ENGINE: DOCKER CONFIGURATION ---
# Base Image: Using python:3.10-slim for a minimal OS footprint and high security.
FROM python:3.10-slim

# SYSTEM DEPENDENCIES
# Installing essential shared libraries for OpenCV and Image processing (libglib, libsm, etc.)
# Using --no-install-recommends and cleaning up lists to keep the image lightweight.
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory within the container
WORKDIR /app

# DEPENDENCY INSTALLATION
# Copying requirements first to leverage Docker layer caching for faster subsequent builds.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# APPLICATION CODE
# Copy the FastAPI application entry point into the container.
COPY main.py .

# NETWORK CONFIGURATION
# VigiByte AI Backend listens on port 8001.
EXPOSE 8001

# EXECUTION COMMAND
# Starting the high-performance ASGI server (Uvicorn).
# Binding to 0.0.0.0 to allow traffic from the VigiByte Frontend.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]