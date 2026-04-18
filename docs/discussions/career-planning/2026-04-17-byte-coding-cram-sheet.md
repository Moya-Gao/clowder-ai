---
topics: [career, interview, bytedance, coding, algorithms, java]
doc_kind: discussion
created: 2026-04-17
updated: 2026-04-17
participants: [gpt52, landy]
---

# 字节一面算法突击包 — 课程表 / 螺旋矩阵 / 逆时针螺旋（Java）

> 目标：面试前快速扫一遍，能把题目讲清楚、把 Java 模板写出来、避开常见坑。
>
> 只背两个母模板：
> 1. `Kahn 拓扑排序`
> 2. `四边界收缩`

---

## 先看这页结论

- `207 / 210` 本质是一题两问：一个问能不能排完，一个问排课顺序。
- `54 / 59 / 逆时针变体` 本质也是一题多变体：一个读矩阵，一个写矩阵，一个改方向。
- `课程表` 最大坑：`[a, b]` 表示 `b -> a`，边方向别写反。
- `螺旋矩阵` 最大坑：每走完一条边都要立刻收缩边界；走第三、第四条边前要判断边界是否交叉。
- 如果面试官说“逆时针螺旋顺序”，先确认：`从哪里出发？第一步往哪走？`

---

## 第一组：课程表 207 / 210

### 题意简述

- `207 Course Schedule`：给定课程数和先修关系，问能不能学完所有课。
- `210 Course Schedule II`：同样的输入，但要输出一个合法的学习顺序。

### 你在面试里先怎么说

> 我把课程和依赖关系抽成一个有向图。  
> 如果 `prerequisites[i] = [a, b]`，表示学 `a` 之前必须先学 `b`，也就是边 `b -> a`。  
> 这样问题就变成：图里有没有环。  
> 没有环就能做拓扑排序；`207` 只要判断能不能覆盖所有节点，`210` 顺手把拓扑序记下来即可。

### 核心思路

1. 建图：`b -> a`
2. 统计每个节点的入度
3. 把所有入度为 `0` 的点入队
4. 每次弹出一个点，就“删除”它对后继节点的影响
5. 如果最后处理了所有节点，说明无环；否则有环

### 复杂度

- 时间：`O(V + E)`
- 空间：`O(V + E)`

### 常见坑

- 把边写反
- `210` 忘了处理有环时返回空数组
- 说成 DFS，但现场写成了 BFS/Kahn，口径前后不一致

### 207 Java 模板

```java
import java.util.*;

public boolean canFinish(int numCourses, int[][] prerequisites) {
    List<Integer>[] g = new ArrayList[numCourses];
    for (int i = 0; i < numCourses; i++) g[i] = new ArrayList<>();
    int[] indeg = new int[numCourses];

    for (int[] p : prerequisites) {
        int a = p[0], b = p[1]; // b -> a
        g[b].add(a);
        indeg[a]++;
    }

    Deque<Integer> q = new ArrayDeque<>();
    for (int i = 0; i < numCourses; i++) {
        if (indeg[i] == 0) q.offer(i);
    }

    int seen = 0;
    while (!q.isEmpty()) {
        int u = q.poll();
        seen++;
        for (int v : g[u]) {
            if (--indeg[v] == 0) q.offer(v);
        }
    }
    return seen == numCourses;
}
```

### 210 Java 模板

```java
import java.util.*;

public int[] findOrder(int numCourses, int[][] prerequisites) {
    List<Integer>[] g = new ArrayList[numCourses];
    for (int i = 0; i < numCourses; i++) g[i] = new ArrayList<>();
    int[] indeg = new int[numCourses];

    for (int[] p : prerequisites) {
        int a = p[0], b = p[1]; // b -> a
        g[b].add(a);
        indeg[a]++;
    }

    Deque<Integer> q = new ArrayDeque<>();
    for (int i = 0; i < numCourses; i++) {
        if (indeg[i] == 0) q.offer(i);
    }

    int[] ans = new int[numCourses];
    int idx = 0;
    while (!q.isEmpty()) {
        int u = q.poll();
        ans[idx++] = u;
        for (int v : g[u]) {
            if (--indeg[v] == 0) q.offer(v);
        }
    }
    return idx == numCourses ? ans : new int[0];
}
```

### 一句话记忆

> `207` 看“能不能全弹完”，`210` 看“弹出的顺序是什么”。

---

## 第二组：螺旋矩阵 54

### 题意简述

给一个二维矩阵，按顺时针螺旋顺序把所有元素读出来。

### 你在面试里先怎么说

> 我用四条边界 `top / bottom / left / right` 控制当前还没处理的矩形区域。  
> 每次按“上、右、下、左”走一圈，走完一条边就收缩对应边界。  
> 关键不是方向，而是边界更新和判交叉。

### 复杂度

- 时间：`O(m * n)`
- 空间：`O(1)`，不算返回结果

### 常见坑

- 忘了在第三、第四条边前判断 `top <= bottom`、`left <= right`
- 边界更新顺序错一位
- 面试官问逆时针，你还在硬写顺时针模板

### 54 Java 模板

```java
import java.util.*;

public List<Integer> spiralOrder(int[][] matrix) {
    List<Integer> ans = new ArrayList<>();
    int top = 0, bottom = matrix.length - 1;
    int left = 0, right = matrix[0].length - 1;

    while (top <= bottom && left <= right) {
        for (int j = left; j <= right; j++) ans.add(matrix[top][j]);
        top++;

        for (int i = top; i <= bottom; i++) ans.add(matrix[i][right]);
        right--;

        if (top <= bottom) {
            for (int j = right; j >= left; j--) ans.add(matrix[bottom][j]);
            bottom--;
        }

        if (left <= right) {
            for (int i = bottom; i >= top; i--) ans.add(matrix[i][left]);
            left++;
        }
    }
    return ans;
}
```

---

## 第三组：逆时针螺旋顺序

### 先确认题意

这个不是固定的 LeetCode 标准题名。面试官可能考的是：

- 左上角出发，先向下
- 左上角出发，先向右但整体逆时针扩展
- 从中心或别的位置出发

如果题面没说清楚，先问清楚。下面这个模板默认：

> 左上角出发，顺序是“下、右、上、左”。

### Java 模板

```java
import java.util.*;

public List<Integer> spiralOrderCCW(int[][] matrix) {
    List<Integer> ans = new ArrayList<>();
    int top = 0, bottom = matrix.length - 1;
    int left = 0, right = matrix[0].length - 1;

    while (top <= bottom && left <= right) {
        for (int i = top; i <= bottom; i++) ans.add(matrix[i][left]);
        left++;

        for (int j = left; j <= right; j++) ans.add(matrix[bottom][j]);
        bottom--;

        if (left <= right) {
            for (int i = bottom; i >= top; i--) ans.add(matrix[i][right]);
            right--;
        }

        if (top <= bottom) {
            for (int j = right; j >= left; j--) ans.add(matrix[top][j]);
            top++;
        }
    }
    return ans;
}
```

### 一句话记忆

> 顺时针是“上右下左”，逆时针只是把方向改成“下右上左”，本质还是四边界收缩。

---

## 第四组：螺旋矩阵 II 59

### 题意简述

给定 `n`，生成一个 `n x n` 矩阵，把 `1..n^2` 按顺时针螺旋顺序填进去。

### 你在面试里先怎么说

> 这题和 `54` 是同一个模板，只不过一个是“读”，一个是“写”。

### Java 模板

```java
public int[][] generateMatrix(int n) {
    int[][] ans = new int[n][n];
    int top = 0, bottom = n - 1, left = 0, right = n - 1;
    int x = 1;

    while (top <= bottom && left <= right) {
        for (int j = left; j <= right; j++) ans[top][j] = x++;
        top++;

        for (int i = top; i <= bottom; i++) ans[i][right] = x++;
        right--;

        if (top <= bottom) {
            for (int j = right; j >= left; j--) ans[bottom][j] = x++;
            bottom--;
        }

        if (left <= right) {
            for (int i = bottom; i >= top; i--) ans[i][left] = x++;
            left++;
        }
    }
    return ans;
}
```

---

## 临场复习顺序

如果只剩 10 分钟，就按这个顺序扫：

1. 先看 `207` 的图建模和 `b -> a`
2. 再看 `210`，确认只是多了一个 `order`
3. 看 `54`，记住四边界和两个判交叉
4. 看“逆时针”变体，防止被方向改题打懵
5. 最后看 `59`，记住它只是“写版 54”

---

## 面试里可以直接说的 30 秒版本

### 课程表

> 这是经典拓扑排序。  
> 我先把依赖关系抽成有向图，`b -> a` 表示先学 `b` 才能学 `a`。  
> 然后用入度数组加队列做 Kahn 算法。  
> `207` 看能不能处理完所有节点，`210` 顺手把处理顺序记下来就是答案。

### 螺旋矩阵

> 我维护四条边界，每次处理一圈。  
> 关键点是走完一条边就更新对应边界，并且在走第三、第四条边前判断边界有没有交叉。  
> `54` 是读，`59` 是写，逆时针只是把方向顺序改掉。

---

## 最后提醒

- `课程表` 比的是建模是否清楚，不是代码是否花哨。
- `螺旋矩阵` 比的是实现是否稳，不是你能不能背出某段模板。
- 如果面试官故意把 `54` 改成逆时针，先确认起点和方向，别急着写。
