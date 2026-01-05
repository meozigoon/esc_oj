### 생성 코드 (CPP17)

```cpp
#include <iostream>
#include <string>
#include <cstdio>
#include <cstdlib>
#include <chrono>

using namespace std;

static const int MIN_LEN = 1;
static const int MAX_LEN = 12; // 필요 시 1000, 1000000 등으로 변경

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

    unsigned int Bounded(unsigned int bound)
    {
        // [0, bound)  (bound > 0)
        return (unsigned int)(((unsigned long long)NextU32() * (unsigned long long)bound) >> 32);
    }

    int NextInt(int lo, int hi)
    {
        unsigned int span = (unsigned int)(hi - lo + 1);
        return lo + (int)Bounded(span);
    }

    bool Chance(double p)
    {
        // p in [0,1]
        // 32-bit 임계값 비교
        unsigned long long threshold = (unsigned long long)(p * 4294967296.0); // 2^32
        return (unsigned long long)NextU32() < threshold;
    }
};

static inline char RandomLetter(SplitMix64 &rng, bool upper)
{
    int v = rng.NextInt(0, 25);
    return upper ? (char)('A' + v) : (char)('a' + v);
}

static inline bool RandomCase(SplitMix64 &rng)
{
    return (rng.NextU32() & 1U) != 0;
}

static void ShuffleString(string &s, SplitMix64 &rng)
{
    // Fisher–Yates
    for (int i = (int)s.size() - 1; i > 0; i--)
    {
        int j = (int)rng.Bounded((unsigned int)(i + 1));
        char tmp = s[(size_t)i];
        s[(size_t)i] = s[(size_t)j];
        s[(size_t)j] = tmp;
    }
}

static string generate_uniform_word(int length, SplitMix64 &rng)
{
    string word;
    word.resize((size_t)length);

    for (int i = 0; i < length; i++)
    {
        bool upper = RandomCase(rng);
        word[(size_t)i] = RandomLetter(rng, upper);
    }
    return word;
}

static string generate_single_dominating(int length, SplitMix64 &rng)
{
    if (length <= 0)
    {
        return string();
    }

    string word;
    word.resize((size_t)length);

    char dominantLower = (char)('a' + rng.NextInt(0, 25));
    char dominantUpper = (char)('A' + (dominantLower - 'a'));

    // "절반 초과" 보장: [length/2 + 1, length]
    int minDom = length / 2 + 1;
    int dominant_freq = (minDom <= length) ? rng.NextInt(minDom, length) : length;

    int idx = 0;

    for (; idx < dominant_freq; idx++)
    {
        word[(size_t)idx] = RandomCase(rng) ? dominantUpper : dominantLower;
    }

    for (; idx < length; idx++)
    {
        bool upper = RandomCase(rng);
        word[(size_t)idx] = RandomLetter(rng, upper);
    }

    ShuffleString(word, rng);
    return word;
}

static string generate_tie_word(int length, SplitMix64 &rng)
{
    char first_lower = (char)('a' + rng.NextInt(0, 25));
    char second_lower = (char)('a' + rng.NextInt(0, 25));
    while (second_lower == first_lower)
    {
        second_lower = (char)('a' + rng.NextInt(0, 25));
    }

    // 원 코드와 동일: 홀수면 1 늘려서 짝수로
    if (length & 1)
    {
        length += 1;
    }

    string word;
    word.resize((size_t)length);

    char first_upper = (char)('A' + (first_lower - 'a'));
    char second_upper = (char)('A' + (second_lower - 'a'));

    int half = length / 2;

    for (int i = 0; i < half; i++)
    {
        word[(size_t)i] = RandomCase(rng) ? first_upper : first_lower;
    }
    for (int i = half; i < length; i++)
    {
        word[(size_t)i] = RandomCase(rng) ? second_upper : second_lower;
    }

    ShuffleString(word, rng);
    return word;
}

static string generate_completely_random_word(int length, SplitMix64 &rng)
{
    // 원 코드와 동일하게 구현(사실상 uniform과 동일)
    string word;
    word.resize((size_t)length);

    for (int i = 0; i < length; i++)
    {
        bool upper = RandomCase(rng);
        word[(size_t)i] = RandomLetter(rng, upper);
    }
    return word;
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

    int test_type = rng.NextInt(0, 3);
    int length = rng.NextInt(MIN_LEN, MAX_LEN);

    // 원 코드 의도대로 20% 확률로 더 큰 length (단, MAX_LEN < 500일 때만)
    if (MAX_LEN < 500 && rng.Chance(0.2))
    {
        length = rng.NextInt(MAX_LEN + 1, 500);
    }

    string test_case;

    if (test_type == 0)
    {
        test_case = generate_uniform_word(length, rng);
    }
    else if (test_type == 1)
    {
        test_case = generate_single_dominating(length, rng);
    }
    else if (test_type == 2)
    {
        test_case = generate_tie_word(length, rng);
    }
    else
    {
        test_case = generate_completely_random_word(length, rng);
    }

    // 빠른 출력
    fwrite(test_case.data(), 1, test_case.size(), stdout);
    fputc('\n', stdout);

    return 0;
}
```
