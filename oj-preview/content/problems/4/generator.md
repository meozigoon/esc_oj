### 생성 코드 (JAVA11)

```java
import java.util.Random;

public class Main {
    public static void main(String[] args) {
        StringBuilder sb = new StringBuilder();
        Random random = new Random();
        int N = random.nextInt(2) + 2;
        sb.append(N).append("\n");
        for (int i = 0; i < N; i++) {
            for (int j = 0; j < N; j++) {
                if (i == N - 1 && j == N - 1) {
                    sb.append(-1);
                } else {
                    int M = random.nextInt(101);
                    sb.append(M);
                }
                if (j < N - 1) {
                    sb.append(" ");
                }
            }
            sb.append("\n");
        }
        System.out.print(sb);
    }
}
```
