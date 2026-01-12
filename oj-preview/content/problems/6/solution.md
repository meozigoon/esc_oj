### 정답 코드 (CPP17)

```cpp
#include <iostream>
#include <vector>
#include <utility>
#include <algorithm>
#include <cstdint>
#include <cstdio>

using namespace std;

vector<int> link;
vector<int> linkSize;

class FastInput
{
private:
    static constexpr size_t BUFSZ = 1 << 20;
    char buf[BUFSZ];
    size_t idx;
    size_t sz;

public:
    FastInput() : idx(0), sz(0)
    {
    }

    inline char ReadChar()
    {
        if (idx >= sz)
        {
            sz = fread(buf, 1, BUFSZ, stdin);
            idx = 0;
            if (sz == 0)
            {
                return 0;
            }
        }
        return buf[idx++];
    }

    template <typename T>
    inline bool ReadInt(T& out)
    {
        char c;
        do
        {
            c = ReadChar();
            if (c == 0)
            {
                return false;
            }
        } while (c <= ' ');

        bool neg = false;
        if (c == '-')
        {
            neg = true;
            c = ReadChar();
        }

        T val = 0;
        while (c > ' ')
        {
            val = val * 10 + (c - '0');
            c = ReadChar();
        }

        out = neg ? -val : val;
        return true;
    }
};

class FastOutput
{
private:
    static constexpr size_t BUFSZ = 1 << 20;
    char buf[BUFSZ];
    size_t idx;

public:
    FastOutput() : idx(0)
    {
    }

    ~FastOutput()
    {
        Flush();
    }

    inline void Flush()
    {
        if (idx)
        {
            fwrite(buf, 1, idx, stdout);
            idx = 0;
        }
    }

    inline void PutChar(char c)
    {
        if (idx >= BUFSZ)
        {
            Flush();
        }
        buf[idx++] = c;
    }

    inline void WriteInt(int v)
    {
        if (v == 0)
        {
            PutChar('0');
            return;
        }

        if (v < 0)
        {
            PutChar('-');
            v = -v;
        }

        char tmp[16];
        int n = 0;
        while (v > 0)
        {
            tmp[n++] = char('0' + (v % 10));
            v /= 10;
        }
        while (n--)
        {
            PutChar(tmp[n]);
        }
    }

    inline void WriteLnInt(int v)
    {
        WriteInt(v);
        PutChar('\n');
    }
};

int find(int x)

{
    int root = x;
    while (root != link[root])
    {
        root = link[root];
    }

    while (x != root)
    {
        int p = link[x];
        link[x] = root;
        x = p;
    }
    return root;
}

bool same(int a, int b)

{
    return (find(a) == find(b));
}

void unite(int a, int b)

{
    a = find(a);
    b = find(b);
    if (a == b)
    {
        return;
    }

    if (linkSize[a] < linkSize[b])
    {
        swap(a, b);
    }
    link[b] = a;
    linkSize[a] += linkSize[b];
}

static inline __int128 dis(pair<long long, long long> p1, pair<long long, long long> p2)

{
    long long dx = p1.first - p2.first;
    long long dy = p1.second - p2.second;
    return (__int128)dx * dx + (__int128)dy * dy;
}

int main(void)

{
    ios::sync_with_stdio(false);
    cin.tie(nullptr), cout.tie(nullptr);

    FastInput in;
    FastOutput out;

    int t;
    in.ReadInt(t);

    while (t--)
    {
        int n;
        in.ReadInt(n);

        vector<long long> r(n);
        vector<pair<long long, long long>> p(n);

        link.resize(n);
        linkSize.assign(n, 1);
        for (int i = 0; i < n; i++)
        {
            link[i] = i;
        }

        for (int i = 0; i < n; i++)
        {
            long long x, y, rr;
            in.ReadInt(x);
            in.ReadInt(y);
            in.ReadInt(rr);
            p[i] = {x, y};
            r[i] = rr;
        }

        for (int i = 0; i < n; i++)
        {
            const long long xi = p[i].first;
            const long long yi = p[i].second;
            const long long ri = r[i];

            for (int j = i + 1; j < n; j++)
            {
                long long dx = xi - p[j].first;
                long long dy = yi - p[j].second;

                __int128 dist2 = (__int128)dx * dx + (__int128)dy * dy;
                long long sum = ri + r[j];
                __int128 sum2 = (__int128)sum * sum;

                if (dist2 <= sum2)
                {
                    unite(i, j);
                }
            }
        }

        vector<char> seen(n, 0);
        int cnt = 0;
        for (int i = 0; i < n; i++)
        {
            int root = find(i);
            if (!seen[root])
            {
                seen[root] = 1;
                cnt++;
            }
        }

        out.WriteLnInt(cnt);
    }

    out.Flush();
    return 0;
}
```
