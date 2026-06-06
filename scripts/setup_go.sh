#!/bin/bash
set -e

WORKSPACE_DIR="/home/aldi/Documents/Project/performance_test"
GO_VERSION="1.22.3"
ARCHIVE_NAME="go${GO_VERSION}.linux-amd64.tar.gz"
DOWNLOAD_URL="https://dl.google.com/go/${ARCHIVE_NAME}"
INSTALL_DIR="${WORKSPACE_DIR}/.go"

echo "=== PerfForge Local Go Environment Setup ==="
echo "Workspace: ${WORKSPACE_DIR}"
echo "Go Version: ${GO_VERSION}"

# Check if Go is already installed locally
if [ -f "${INSTALL_DIR}/go/bin/go" ]; then
    echo "Local Go installation already exists at ${INSTALL_DIR}/go/bin/go"
    "${INSTALL_DIR}/go/bin/go" version
    exit 0
fi

mkdir -p "${INSTALL_DIR}"

echo "Downloading Go from ${DOWNLOAD_URL}..."
curl -L "${DOWNLOAD_URL}" -o "${WORKSPACE_DIR}/${ARCHIVE_NAME}"

echo "Extracting Go archive..."
tar -C "${INSTALL_DIR}" -xzf "${WORKSPACE_DIR}/${ARCHIVE_NAME}"

echo "Cleaning up archive..."
rm "${WORKSPACE_DIR}/${ARCHIVE_NAME}"

echo "Verifying local Go installation..."
if [ -f "${INSTALL_DIR}/go/bin/go" ]; then
    echo "Go installed successfully!"
    "${INSTALL_DIR}/go/bin/go" version
else
    echo "ERROR: Go installation failed. Binary not found."
    exit 1
fi
