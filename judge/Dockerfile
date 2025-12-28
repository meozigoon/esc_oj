FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    openjdk-11-jdk \
    python3 \
    mono-devel \
    time \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
