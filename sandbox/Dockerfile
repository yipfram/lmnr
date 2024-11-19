# Use a Python image with uv pre-installed
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Install the project into `/sandbox`
COPY ./sandbox/ /sandbox/
COPY ./pyproject.toml /sandbox/
COPY ./uv.lock /sandbox/
WORKDIR /sandbox

RUN uv sync --frozen --no-install-project --no-dev

# Place executables in the environment at the front of the path
ENV PATH="/sandbox/.venv/bin:$PATH"

# Reset the entrypoint, don't invoke `uv`
ENTRYPOINT []

# Install the kernel
RUN python -m ipykernel install --prefix=/usr/local --name=sandbox-kernel

# Expose the port your gRPC server runs on
EXPOSE 8812

# Command to run your server
CMD ["python", "server.py"]
