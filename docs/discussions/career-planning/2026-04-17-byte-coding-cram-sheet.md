---
topics: [career, interview, bytedance, coding, algorithms, java]
doc_kind: discussion
created: 2026-04-17
updated: 2026-04-22
participants: [gpt52, opus, landy]
---

# 字节一面算法突击包 — 课程表 / 螺旋矩阵（Java）

> 五年没刷题版。每道题按这个顺序看：原题 → 想法 → 图解 → 代码 → 坑。
>
> 只有两个核心思想：
> 1. **拓扑排序**（课程表）：按依赖顺序一层一层剥洋葱
> 2. **边界收缩**（螺旋矩阵）：画一个框，转一圈，框缩小，再转一圈

---

## 一、课程表 207 — 能不能学完？

### 原题（LeetCode 207. Course Schedule）

你要修 `numCourses` 门课，编号 `0` 到 `numCourses-1`。
有些课有先修要求，用数组 `prerequisites` 表示，比如 `[1, 0]` 表示**想学课 1，必须先学课 0**。
问：能不能学完所有课？

```
输入: numCourses = 4, prerequisites = [[1,0],[2,0],[3,1],[3,2]]
输出: true

解释: 先学 0 → 再学 1 和 2 → 最后学 3。没有死循环，能学完。
```

```
输入: numCourses = 2, prerequisites = [[1,0],[0,1]]
输出: false

解释: 学 1 要先学 0，学 0 要先学 1。死循环了，学不完。
```

### 想法：这就是"有没有死循环"

把课程想成一张图：每个课是一个点，"先学 A 才能学 B" 就画一条箭头 A → B。

如果图里有环（A→B→C→A），就永远有课的前置没法满足，学不完。
如果没有环，就一定能找到一个合法的学习顺序。

### 怎么检测有没有环？Kahn 算法（剥洋葱）

核心想法特别直观：

1. 每个课有一个**入度**（有多少门前置课指向它）。入度 = 0 说明"不需要任何前置，现在就能学"
2. 把所有入度 = 0 的课放进队列，开始学
3. 每学完一门课，就把它指向的后续课的入度减 1（相当于"这个前置我已经修了"）
4. 如果某门课的入度降到了 0，说明它的所有前置都学完了，放进队列
5. 重复，直到队列空了
6. 如果所有课都学过了 → 没有环 → 返回 true；否则有环 → false

### 图解

```
prerequisites = [[1,0],[2,0],[3,1],[3,2]]

画成图：
  0 → 1 → 3
  0 → 2 → 3

入度：0 的入度=0, 1 的入度=1, 2 的入度=1, 3 的入度=2

第 1 轮：入度=0 的只有 [0]，学 0
  → 学完 0，把 1 的入度减 1（变成 0），把 2 的入度减 1（变成 0）
  → 队列：[1, 2]

第 2 轮：学 1
  → 把 3 的入度减 1（变成 1）

第 3 轮：学 2
  → 把 3 的入度减 1（变成 0）
  → 队列：[3]

第 4 轮：学 3

学了 4 门 = numCourses = 4 → true
```

### Java 代码

```java
public boolean canFinish(int numCourses, int[][] prerequisites) {
    // 1. 建图 + 统计入度
    List<Integer>[] graph = new ArrayList[numCourses];
    for (int i = 0; i < numCourses; i++) graph[i] = new ArrayList<>();
    int[] inDegree = new int[numCourses];

    for (int[] pre : prerequisites) {
        // pre = [a, b] 意思是"学 a 之前要先学 b"，所以箭头是 b → a
        graph[pre[1]].add(pre[0]);
        inDegree[pre[0]]++;
    }

    // 2. 把入度=0 的课放进队列（这些课没有前置，可以直接学）
    Deque<Integer> queue = new ArrayDeque<>();
    for (int i = 0; i < numCourses; i++) {
        if (inDegree[i] == 0) queue.offer(i);
    }

    // 3. 一门一门学，每学完一门就更新后续课的入度
    int learned = 0;
    while (!queue.isEmpty()) {
        int course = queue.poll();
        learned++;
        for (int next : graph[course]) {
            inDegree[next]--;
            if (inDegree[next] == 0) queue.offer(next);
        }
    }

    // 4. 学完的数量 = 总数 → 没有环
    return learned == numCourses;
}
```

### 常见坑

- **边方向写反**：`[a, b]` 表示 b→a，不是 a→b。面试时口头确认一遍
- 时间复杂度 `O(V+E)`，空间 `O(V+E)`，V=课程数，E=先修关系数

---

## 二、课程表 II 210 — 给出学习顺序

### 原题（LeetCode 210. Course Schedule II）

和 207 完全一样的输入，但这次要**输出一个合法的学习顺序**。如果有环（学不完），返回空数组。

```
输入: numCourses = 4, prerequisites = [[1,0],[2,0],[3,1],[3,2]]
输出: [0, 1, 2, 3]  （或 [0, 2, 1, 3]，合法即可）
```

### 想法

和 207 完全一样！唯一区别：**把每次从队列弹出的课记下来**，弹出的顺序就是答案。

### Java 代码

```java
public int[] findOrder(int numCourses, int[][] prerequisites) {
    List<Integer>[] graph = new ArrayList[numCourses];
    for (int i = 0; i < numCourses; i++) graph[i] = new ArrayList<>();
    int[] inDegree = new int[numCourses];

    for (int[] pre : prerequisites) {
        graph[pre[1]].add(pre[0]);
        inDegree[pre[0]]++;
    }

    Deque<Integer> queue = new ArrayDeque<>();
    for (int i = 0; i < numCourses; i++) {
        if (inDegree[i] == 0) queue.offer(i);
    }

    int[] order = new int[numCourses];
    int idx = 0;
    while (!queue.isEmpty()) {
        int course = queue.poll();
        order[idx++] = course;  // 就比 207 多了这一行
        for (int next : graph[course]) {
            if (--inDegree[next] == 0) queue.offer(next);
        }
    }

    return idx == numCourses ? order : new int[0];  // 有环返回空数组
}
```

### 面试话术

> "207 和 210 本质是同一道题。207 问能不能排完，210 问排出来的顺序是什么。代码只差一行：把弹出的课记进数组。"

---

## 三、螺旋矩阵 54 — 顺时针读出来

### 原题（LeetCode 54. Spiral Matrix）

给一个 `m×n` 的二维矩阵，按**顺时针螺旋**顺序，把所有元素读出来返回一个列表。

```
输入:
  1  2  3
  4  5  6
  7  8  9

输出: [1, 2, 3, 6, 9, 8, 7, 4, 5]

走法：
  → → →
        ↓
  ← ← ←
  ↓
  →
```

```
输入:
  1  2  3  4
  5  6  7  8
  9 10 11 12

输出: [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7]
```

### 想法：画个框，转一圈，框缩小

想象你在矩阵外面画了一个矩形框，用四条线标记边界：

- `top`：当前最上面一行的行号
- `bottom`：当前最下面一行的行号
- `left`：当前最左边一列的列号
- `right`：当前最右边一列的列号

每一圈做四步：
1. **→ 沿着顶边从左到右**，走完后 `top++`（顶边用完了，缩进来）
2. **↓ 沿着右边从上到下**，走完后 `right--`（右边用完了）
3. **← 沿着底边从右到左**，走完后 `bottom--`（底边用完了）
4. **↑ 沿着左边从下到上**，走完后 `left++`（左边用完了）

重复，直到框缩没了（`top > bottom` 或 `left > right`）。

### 图解

```
初始：top=0, bottom=2, left=0, right=2

  [1  2  3]  ← top=0
  [4  5  6]
  [7  8  9]  ← bottom=2
   ↑     ↑
 left=0  right=2

第 1 圈：
  → 读 top 行：1, 2, 3     → top 变 1
  ↓ 读 right 列：6, 9      → right 变 1
  ← 读 bottom 行：8, 7     → bottom 变 1
  ↑ 读 left 列：4          → left 变 1

第 2 圈：top=1, bottom=1, left=1, right=1
  → 读 top 行：5            → top 变 2
  此时 top > bottom，结束

结果：[1, 2, 3, 6, 9, 8, 7, 4, 5] ✓
```

### 关键细节：第 3、4 步要判断

走完前两步后，框可能已经退化成一行或一列。如果不判断就会重复读：

- 第 3 步（← 底边）之前：检查 `top <= bottom`，不然底边已经和顶边重合了
- 第 4 步（↑ 左边）之前：检查 `left <= right`，不然左边已经和右边重合了

### Java 代码

```java
public List<Integer> spiralOrder(int[][] matrix) {
    List<Integer> result = new ArrayList<>();
    int top = 0, bottom = matrix.length - 1;
    int left = 0, right = matrix[0].length - 1;

    while (top <= bottom && left <= right) {
        // → 沿顶边从左到右
        for (int col = left; col <= right; col++)
            result.add(matrix[top][col]);
        top++;

        // ↓ 沿右边从上到下
        for (int row = top; row <= bottom; row++)
            result.add(matrix[row][right]);
        right--;

        // ← 沿底边从右到左（要先判断还有没有底边）
        if (top <= bottom) {
            for (int col = right; col >= left; col--)
                result.add(matrix[bottom][col]);
            bottom--;
        }

        // ↑ 沿左边从下到上（要先判断还有没有左边）
        if (left <= right) {
            for (int row = bottom; row >= top; row--)
                result.add(matrix[row][left]);
            left++;
        }
    }
    return result;
}
```

### 常见坑

- 忘了第 3、4 步的 if 判断 → 重复读取
- `top++` 和 `right--` 的时机搞错（走完那条边之后立刻更新）

---

## 四、螺旋矩阵 II 59 — 顺时针填进去

### 原题（LeetCode 59. Spiral Matrix II）

给一个数字 `n`，生成 `n×n` 矩阵，把 `1, 2, 3, ..., n²` 按顺时针螺旋顺序填进去。

```
输入: n = 3

输出:
  1  2  3
  8  9  4
  7  6  5
```

### 想法

和 54 完全一样的框+转圈逻辑，只不过 54 是"读出来"，59 是"写进去"。

### Java 代码

```java
public int[][] generateMatrix(int n) {
    int[][] matrix = new int[n][n];
    int top = 0, bottom = n - 1, left = 0, right = n - 1;
    int num = 1;  // 从 1 开始填

    while (top <= bottom && left <= right) {
        for (int col = left; col <= right; col++)
            matrix[top][col] = num++;
        top++;

        for (int row = top; row <= bottom; row++)
            matrix[row][right] = num++;
        right--;

        if (top <= bottom) {
            for (int col = right; col >= left; col--)
                matrix[bottom][col] = num++;
            bottom--;
        }

        if (left <= right) {
            for (int row = bottom; row >= top; row--)
                matrix[row][left] = num++;
            left++;
        }
    }
    return matrix;
}
```

### 面试话术

> "59 和 54 是同一个模板。一个是读矩阵，一个是写矩阵，边界收缩逻辑完全一样。"

---

## 五、逆时针螺旋 — 面试官的变体追问

### 这不是标准 LeetCode 题

面试官可能在 54 基础上追问："如果改成逆时针呢？"

**第一件事：确认起点和方向。** 最常见的逆时针定义是：

> 从左上角出发，先**向下**，然后右→上→左，循环。

顺时针是 →↓←↑，逆时针是 ↓→↑←，就是把方向顺序换了。

### 图解

```
3×3 矩阵逆时针：

  1  2  3        读取顺序:
  4  5  6        1→4→7 (↓左边), 8→9 (→底边),
  7  8  9        6→3 (↑右边), 2 (←顶边), 5

  ↓ 先向下走左边
  → 再向右走底边
  ↑ 再向上走右边
  ← 最后向左走顶边
```

### Java 代码

```java
public List<Integer> spiralOrderCCW(int[][] matrix) {
    List<Integer> result = new ArrayList<>();
    int top = 0, bottom = matrix.length - 1;
    int left = 0, right = matrix[0].length - 1;

    while (top <= bottom && left <= right) {
        // ↓ 沿左边从上到下
        for (int row = top; row <= bottom; row++)
            result.add(matrix[row][left]);
        left++;

        // → 沿底边从左到右
        for (int col = left; col <= right; col++)
            result.add(matrix[bottom][col]);
        bottom--;

        // ↑ 沿右边从下到上（判断）
        if (left <= right) {
            for (int row = bottom; row >= top; row--)
                result.add(matrix[row][right]);
            right--;
        }

        // ← 沿顶边从右到左（判断）
        if (top <= bottom) {
            for (int col = right; col >= left; col--)
                result.add(matrix[top][col]);
            top++;
        }
    }
    return result;
}
```

---

## 临场速查卡（面试前 5 分钟看这里）

### 课程表 207/210

- 题目：能不能学完 / 给出学习顺序
- 核心：**拓扑排序 = 剥洋葱**。找入度=0 的课，学完后更新后续课的入度
- 代码关键：`[a, b]` 表示 b→a（**边方向别写反！**）
- 区别：207 数 `learned == numCourses`，210 多一行 `order[idx++] = course`

### 螺旋矩阵 54/59

- 题目：顺时针读出来 / 顺时针填进去
- 核心：**四边界收缩**。每走完一条边就缩一条边
- 代码关键：第 3、4 条边前加 `if (top <= bottom)` / `if (left <= right)`
- 区别：54 是 `result.add(matrix[...])` 读，59 是 `matrix[...] = num++` 写

### 逆时针变体

- 先问面试官："从哪出发？先往哪走？"
- 默认是 ↓→↑←（把顺时针的 →↓←↑ 改方向）
- 模板结构完全一样，只是四个 for 循环的遍历方向不同

---

*[布偶猫/宪宪🐾 + 砚砚/GPT-5.4🐾] 字节一面算法突击包 v2 — 五年没刷题友好版*
