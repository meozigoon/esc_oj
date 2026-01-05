### 정답 코드 (CPP17)

```cpp
#include <iostream>

using namespace std;

int main(void)
{
    int ch = 0;
    int arr[5];
    for (int i = 0; i < 5; i++)
        cin >> arr[i];
    int tmp = 1;
    while (ch < 3)
    {
        ch = 0;
        for(int i = 0; i < 5; i++)
            if(tmp % arr[i] == 0)
                ch++;
        tmp++;
    }
    tmp--;
    cout << tmp;
}
```
