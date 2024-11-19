from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class RunCodeRequest(_message.Message):
    __slots__ = ("code",)
    CODE_FIELD_NUMBER: _ClassVar[int]
    code: str
    def __init__(self, code: _Optional[str] = ...) -> None: ...

class Result(_message.Message):
    __slots__ = ("text", "image")
    TEXT_FIELD_NUMBER: _ClassVar[int]
    IMAGE_FIELD_NUMBER: _ClassVar[int]
    text: str
    image: str
    def __init__(self, text: _Optional[str] = ..., image: _Optional[str] = ...) -> None: ...

class RunCodeResponse(_message.Message):
    __slots__ = ("results", "stdout", "stderr")
    RESULTS_FIELD_NUMBER: _ClassVar[int]
    STDOUT_FIELD_NUMBER: _ClassVar[int]
    STDERR_FIELD_NUMBER: _ClassVar[int]
    results: _containers.RepeatedCompositeFieldContainer[Result]
    stdout: str
    stderr: str
    def __init__(self, results: _Optional[_Iterable[_Union[Result, _Mapping]]] = ..., stdout: _Optional[str] = ..., stderr: _Optional[str] = ...) -> None: ...

class HealthcheckRequest(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class HealthcheckResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...
