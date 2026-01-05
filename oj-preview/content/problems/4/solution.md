### 정답 코드 (CPP17)

```cpp
#include <iostream>
#include <queue>
#define f first
#define s second

using namespace std;

int map[3][3];
int n;

string dfs()
{
	queue<pair<int, int>>v;
	v.push(make_pair(0, 0));
	int step;
	int x;
	int y;
	while (!v.empty())
	{
        auto t = v.front();
		x = t.f; y = t.s;
        v.pop();
		step = map[x][y];
		if (step == -1)
		{
			return "Happy";
		}
		if (step == 0) continue;

		if (x + step < n)
		{
			v.push(make_pair(x + step, y));
		}
		if (y + step < n)
		{
			v.push(make_pair(x, y + step));
		}
		
	}

	return "Sad";
}

int main()
{
	ios::sync_with_stdio(false);
	cin.tie(0);
	cout.tie(0);
	cin >> n;
	for (int i = 0; i < n; i++)
	{
		for (int j = 0; j < n; j++)
		{
			cin >> map[j][i];
		}
	}
	cout << dfs();
	return 0;
}
```
