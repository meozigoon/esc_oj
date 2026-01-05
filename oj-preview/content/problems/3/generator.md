### 생성 코드 (CPP17)

```cpp
#include <iostream>
#include <vector>
#include <string>
#include <charconv>
#include <cstdio>
#include <chrono>
#include <cstdlib>

using namespace std;

static const int COORD_MIN = -50000;
static const int COORD_MAX =  50000;

struct SplitMix64
{
    unsigned long long x;

    explicit SplitMix64(unsigned long long seed) : x(seed) {}

    unsigned long long NextU64()
    {
        unsigned long long z = (x += 0x9e3779b97f4a7c15ULL);
        z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9ULL;
        z = (z ^ (z >> 27)) * 0x94d049bb133111ebULL;
        return z ^ (z >> 31);
    }

    unsigned int NextU32()
    {
        return (unsigned int)(NextU64() >> 32);
    }

    // [0, bound) (bound > 0)
    unsigned int Bounded(unsigned int bound)
    {
        // (rand32 * bound) >> 32  : 빠르고 편향이 매우 작음(테스트케이스 생성 용도로 충분)
        return (unsigned int)(((unsigned long long)NextU32() * (unsigned long long)bound) >> 32);
    }

    // [lo, hi]
    int NextInt(int lo, int hi)
    {
        unsigned int span = (unsigned int)(hi - lo + 1);
        return lo + (int)Bounded(span);
    }
};

static inline void AppendInt(string &out, int v)
{
    char buf[32];
    auto res = to_chars(buf, buf + 32, v);
    out.append(buf, res.ptr);
}

int main(int argc, char* argv[])
{
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    cout.tie(nullptr);

    unsigned long long seed =
        (unsigned long long)chrono::high_resolution_clock::now().time_since_epoch().count();
    if (argc >= 2)
    {
        seed = strtoull(argv[1], nullptr, 10);
    }

    SplitMix64 rng(seed);

    int n = (argc >= 3) ? (int)strtol(argv[2], nullptr, 10) : rng.NextInt(1, 100000);
    if (n < 1)
    {
        n = 1;
    }
    if (n > 100000)
    {
        n = 100000;
    }

    // mode:
    // 0: 균등 랜덤
    // 1: 클러스터 + 아웃라이어
    // 2: 거의 직선
    // 3: 코너 근처
    int mode = (argc >= 4) ? (int)strtol(argv[3], nullptr, 10) : rng.NextInt(0, 3);
    if (mode < 0 || mode > 3)
    {
        mode = rng.NextInt(0, 3);
    }

    vector<pair<int, int>> pts;
    pts.resize((size_t)n);

    if (mode == 0)
    {
        for (int i = 0; i < n; i++)
        {
            int x = rng.NextInt(COORD_MIN, COORD_MAX);
            int y = rng.NextInt(COORD_MIN, COORD_MAX);
            pts[(size_t)i] = {x, y};
        }
    }
    else if (mode == 1)
    {
        int cx = rng.NextInt(COORD_MIN, COORD_MAX);
        int cy = rng.NextInt(COORD_MIN, COORD_MAX);
        int r = rng.NextInt(50, 5000);

        int outliers = n / 50;
        if (outliers < 1)
        {
            outliers = 1;
        }
        if (outliers > n)
        {
            outliers = n;
        }

        int i = 0;
        for (; i < outliers; i++)
        {
            int x = rng.NextInt(COORD_MIN, COORD_MAX);
            int y = rng.NextInt(COORD_MIN, COORD_MAX);
            pts[(size_t)i] = {x, y};
        }
        for (; i < n; i++)
        {
            int x = cx + rng.NextInt(-r, r);
            int y = cy + rng.NextInt(-r, r);
            if (x < COORD_MIN) x = COORD_MIN;
            if (x > COORD_MAX) x = COORD_MAX;
            if (y < COORD_MIN) y = COORD_MIN;
            if (y > COORD_MAX) y = COORD_MAX;
            pts[(size_t)i] = {x, y};
        }
    }
    else if (mode == 2)
    {
        int x0 = rng.NextInt(COORD_MIN, COORD_MAX);
        int y0 = rng.NextInt(COORD_MIN, COORD_MAX);

        int vx = rng.NextInt(-1000, 1000);
        int vy = rng.NextInt(-1000, 1000);
        if (vx == 0 && vy == 0)
        {
            vx = 1;
        }

        int noise = rng.NextInt(0, 30);

        for (int i = 0; i < n; i++)
        {
            int t = rng.NextInt(-100000, 100000);
            long long x = (long long)x0 + (long long)vx * (long long)t;
            long long y = (long long)y0 + (long long)vy * (long long)t;

            if (noise != 0)
            {
                x += rng.NextInt(-noise, noise);
                y += rng.NextInt(-noise, noise);
            }

            if (x < COORD_MIN) x = COORD_MIN;
            if (x > COORD_MAX) x = COORD_MAX;
            if (y < COORD_MIN) y = COORD_MIN;
            if (y > COORD_MAX) y = COORD_MAX;

            pts[(size_t)i] = {(int)x, (int)y};
        }
    }
    else
    {
        // corners
        const int cornersX[4] = {COORD_MIN, COORD_MIN, COORD_MAX, COORD_MAX};
        const int cornersY[4] = {COORD_MIN, COORD_MAX, COORD_MIN, COORD_MAX};

        int jitter = rng.NextInt(0, 2000);

        for (int i = 0; i < n; i++)
        {
            int idx = rng.NextInt(0, 3);
            int x = cornersX[idx] + rng.NextInt(-jitter, jitter);
            int y = cornersY[idx] + rng.NextInt(-jitter, jitter);

            if (x < COORD_MIN) x = COORD_MIN;
            if (x > COORD_MAX) x = COORD_MAX;
            if (y < COORD_MIN) y = COORD_MIN;
            if (y > COORD_MAX) y = COORD_MAX;

            pts[(size_t)i] = {x, y};
        }
    }

    // 빠른 출력: string 버퍼에 모두 쌓아 한 번에 fwrite
    string out;
    out.reserve((size_t)n * 24 + 32);

    AppendInt(out, n);
    out.push_back('\n');

    for (int i = 0; i < n; i++)
    {
        AppendInt(out, pts[(size_t)i].first);
        out.push_back(' ');
        AppendInt(out, pts[(size_t)i].second);
        out.push_back('\n');
    }

    fwrite(out.data(), 1, out.size(), stdout);
    return 0;
}
```
