# python-executor

This is a service which executes Python code.

## Running locally without docker

```
uv

cd python_sandbox
# if you've updated proto files, run
python -m grpc_tools.protoc -I ../proto/ --python_out=./ --grpc_python_out=./ --pyi_out=./ ../proto/python_sandbox.proto

python server.py
```

## Running locally with docker

```
docker build -t python-executor .
docker run -p 8811:8811 python-executor
```
