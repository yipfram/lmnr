# python-executor

This is a service which executes Python code.

## Running locally without docker

```
uv sync

cd sandbox
# if you've updated proto files, run
python -m grpc_tools.protoc -I ../proto/ --python_out=./ --grpc_python_out=./ --pyi_out=./ ../proto/sandbox.proto

python server.py
```

## Running locally with docker

```
docker build -t sandbox .
docker run -p 8812:8812 sandbox
```
