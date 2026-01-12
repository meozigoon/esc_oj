### 생성 코드 (CPP17)

```cpp
#include <iostream>
#include <cstdio>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <algorithm>
#include <chrono>

using namespace std;

struct Circle
{
    int x;
    int y;
    int r;
};

static inline uint64_t Fnv1a64(const char* s)
{
    uint64_t h = 1469598103934665603ULL;
    while (*s)
    {
        h ^= static_cast<unsigned char>(*s);
        h *= 1099511628211ULL;
        s++;
    }
    return h;
}

static inline uint64_t ParseSeed(int argc, char* argv[])
{
    if (argc >= 2)
    {
        char* end = nullptr;
        unsigned long long v = strtoull(argv[1], &end, 10);
        if (end != nullptr && *end == '\0')
        {
            return static_cast<uint64_t>(v);
        }
        return Fnv1a64(argv[1]);
    }

    uint64_t t = static_cast<uint64_t>(
        chrono::high_resolution_clock::now().time_since_epoch().count()
    );
    uint64_t m = static_cast<uint64_t>(reinterpret_cast<uintptr_t>(&argc));
    return t ^ (m + 0x9e3779b97f4a7c15ULL);
}

class FastRng
{
private:
    uint64_t state;

    static inline uint64_t NextU64(uint64_t& x)
    {
        x += 0x9e3779b97f4a7c15ULL;
        uint64_t z = x;
        z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9ULL;
        z = (z ^ (z >> 27)) * 0x94d049bb133111ebULL;
        return z ^ (z >> 31);
    }

public:
    explicit FastRng(uint64_t seed) : state(seed)
    {
    }

    inline uint64_t Next()
    {
        return NextU64(state);
    }

    inline int NextInt(int l, int r)
    {
        uint64_t range = static_cast<uint64_t>(static_cast<uint32_t>(r - l)) + 1ULL;
        uint64_t limit = UINT64_MAX - (UINT64_MAX % range);

        uint64_t x;
        do
        {
            x = Next();
        } while (x >= limit);

        return l + static_cast<int>(x % range);
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
            tmp[n++] = static_cast<char>('0' + (v % 10));
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

    inline void WriteTripleLn(int a, int b, int c)
    {
        WriteInt(a);
        PutChar(' ');
        WriteInt(b);
        PutChar(' ');
        WriteInt(c);
        PutChar('\n');
    }
};

static inline int ClampInt(int v, int lo, int hi)
{
    if (v < lo)
    {
        return lo;
    }
    if (v > hi)
    {
        return hi;
    }
    return v;
}

int main(int argc, char* argv[])

{
    ios::sync_with_stdio(false); cin.tie(nullptr), cout.tie(nullptr);

    uint64_t seed = ParseSeed(argc, argv);
    FastRng rnd(seed);
    FastOutput out;

    int T = rnd.NextInt(1, 5);
    out.WriteLnInt(T);

    for (int t = 0; t < T; t++)
    {
        int N = rnd.NextInt(1, 10);
        int K = rnd.NextInt(1, min(N, 3));
        int Rbound = rnd.NextInt(0, 1000);

        int sz[3] = {0, 0, 0};
        for (int i = 0; i < K; i++)
        {
            sz[i] = 1;
        }
        for (int i = 0; i < N - K; i++)
        {
            sz[rnd.NextInt(0, K - 1)]++;
        }

        int centersX[3];
        int centersY[3];

        // K <= 3 이므로 trig 없이 상수로 각도 배치(원래 코드와 동일한 배치)
        // i=0: (4500, 2500)
        // K=2, i=1: (500, 2500)
        // K=3, i=1: (1500, 4232), i=2: (1500, 768)  (2000*sin(120°)=1732 근사)
        if (K == 1)
        {
            centersX[0] = 4500;
            centersY[0] = 2500;
        }
        else if (K == 2)
        {
            centersX[0] = 4500; centersY[0] = 2500;
            centersX[1] = 500;  centersY[1] = 2500;
        }
        else
        {
            centersX[0] = 4500; centersY[0] = 2500;
            centersX[1] = 1500; centersY[1] = 4232;
            centersX[2] = 1500; centersY[2] = 768;
        }

        for (int i = 0; i < K; i++)
        {
            centersX[i] += rnd.NextInt(-100, 100);
            centersY[i] += rnd.NextInt(-100, 100);
            centersX[i] = ClampInt(centersX[i], 0, 5000);
            centersY[i] = ClampInt(centersY[i], 0, 5000);
        }

        Circle circles[10];
        int cnt = 0;

        for (int i = 0; i < K; i++)
        {
            int x = centersX[i];
            int y = centersY[i];
            for (int j = 0; j < sz[i]; j++)
            {
                int r = rnd.NextInt(0, Rbound);
                circles[cnt++] = {x, y, r};
            }
        }

        // Fisher–Yates shuffle
        for (int i = cnt - 1; i >= 1; i--)
        {
            int j = rnd.NextInt(0, i);
            swap(circles[i], circles[j]);
        }

        out.WriteLnInt(N);
        for (int i = 0; i < cnt; i++)
        {
            out.WriteTripleLn(circles[i].x, circles[i].y, circles[i].r);
        }
    }

    out.Flush();
    return 0;
}
```
