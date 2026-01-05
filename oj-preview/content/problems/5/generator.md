### 생성 코드 (PYTHON3)

```python
import random

num_pool = list(range(1, 101))
random.shuffle(num_pool)

print(' '.join(map(str, num_pool[:5])))
```
