---
layout: post
author: tom
title: Implementing Dancing Links in Java
tags: java algorithmx dancing-links sudoku sudoku-solver
---

If you search for "sudoku solver < PROGRAMMING LANGUAGE >" in the search engine of your choice, you will find countless 
articles explaining 
exactly how [Algorithm X](https://en.wikipedia.org/wiki/Knuth's_Algorithm_X){:target="_blank"}, in conjunction with the 
[Dancing Links](https://en.wikipedia.org/wiki/Dancing_Links){:target="_blank"} technique, can be used to solve Sudoku puzzles once they 
have been reduced to an [Exact Cover Problem](https://en.wikipedia.org/wiki/Exact_cover){:target="_blank"}. If you find number puzzles 
fascinating, those three links will provide you with a good nights reading. If you find number puzzles fascinating, 
and you're me, you won't really understand it and will set off to try and replicate it in the programming language of 
your choice. Because I am me, that is exactly what happened.

<br>

During my research, I found a pattern of articles which demonstrated Java implementations that were heavily 
influenced by [this](https://github.com/rafalio/dancing-links-java){:target="_blank"} GitHub repository. For example, 
[Baeldung](https://www.baeldung.com/java-sudoku){:target="_blank"} has an article which references that specific repository, and this 
[Medium Article](https://medium.com/javarevisited/building-a-sudoku-solver-in-java-with-dancing-links-180274b0b6c1){:target="_blank"} 
(among others), which for me was a top search result, uses a very similar style. The intent of this post is to 
break down my implementation of dancing links, highlighting differences I made, what each class does and why it does 
it, and where there is room for improvement. Note that converting Sudoku to an exact cover matrix is not covered in 
this post, as that has enough content for a dedicated article. 


## Understanding the Algorithm

I don't believe I can explain Dancing Links better than what has already been done. I recommend you read 
[this](https://garethrees.org/2007/06/10/zendoku-generation/#section-4){:target="_blank"} article by Gareth Rees (one of the devs on 
the Nintendo 3DS game Zendoku), as well as the above linked Wikipedia articles.

## Java Implementation

You can view the current source code at [GitHub](https://github.com/tajacks/algx-j){:target="_blank"}.

<br>

The goal in this project was to build a puzzle agnostic exact cover matrix solver. Once we have a method for 
constructing, and attempting to solve, exact cover matrices, we can apply it against any puzzle which can be reduced to 
such. For this reason, I started with a public API to model our matrix. The matrix must have `n` columns representing 
constraints, and, `t` rows containing an amount of values `v` equal to `n`. In other words, the matrix can have any 
number of columns and rows, but, each row must have exactly the amount of values as there are columns. This makes 
sense, as we are using our values to indicate whether a specific constraint (column) is satisfied (true) or not 
(false).

### The Input Matrix

#### Matrix Column
```java
public record MatrixColumn(String constraintLabel) {
    public MatrixColumn {
        if (constraintLabel == null || constraintLabel.isEmpty()) {
            throw new IllegalArgumentException("Constraint label cannot be null or empty");
        }
    }
}
```
The `MatrixColumn` record represents a constraint. To make this meaningful, we require a non-null and non-empty 
friendly name passed in the constructor. 

#### Matrix Row
```java
public record MatrixRow(String valueLabel, boolean[] values) {
    public MatrixRow {
        if (valueLabel == null || valueLabel.isEmpty()) {
            throw new IllegalArgumentException("Constraint label cannot be null or empty");
        }
    }
}
```
The `MatrixRow` record represents a combination which fulfills some, all, or no constraints. To make this meaningful,
we require a non-null and non-empty friendly name passed in the constructor, as well as an array of boolean values, 
sized to the amount of columns. 

<br>

To really drive this point home on what is being created here, imagine these objects _(The example here 
was one that I found on another blog when investigating this problem)_:
<br>
```java
new MatrixColumn("Wallet"), new MatrixColumn("Keys"), new MatrixColumn("Phone")
new MatrixRow("1", new boolean[]{ true, false, true }), 
new MatrixRow("2", new boolean[]{ true, true, true }),
new MatrixRow("3", new boolean[]{ false, false, false })
```

In the above, we have three columns representing things you need before you leave the house. In Matrix Row 1, the 
first value in the `boolean[]` is `true`. This indicates that the "Wallet" constraint is satisfied (as that is the 
first column). Unfortunately, "Keys" is not satisfied, indicated by `false` as the second value in the array. Each 
row represents a combination of satisfied or non-satisfied constraints. 

<br>

To tie these rows and columns together, and to enforce logic which ensures a valid board, I created an 
`ExactCoverMatrix` record. 

```java
public record ExactCoverMatrix(List<MatrixColumn> columns, List<MatrixRow> rows) {
    public ExactCoverMatrix {
        checkValidRowsAndColumns(columns, rows);
    }

    // Perform all row and column validity checks.
    private void checkValidRowsAndColumns(List<MatrixColumn> columns, List<MatrixRow> rows) throws IllegalArgumentException {
        checkColumnNameValidity(columns);
        checkRowNameValidity(rows);
        rows.forEach(row -> checkRowSizeValidity(columns, row));
    }

    // Only allow rows where the number of values is equal to the number of columns exactly.
    private void checkRowSizeValidity(List<MatrixColumn> columns, MatrixRow row) throws IllegalArgumentException {
        if (row.values().length != columns.size()) {
            throw new IllegalArgumentException("Mis-matched row size. Exactly " + columns.size() + " columns required, received: " + row.values().length + " from " + row);
        }
    }

    // Ensure that no rows have duplicated names. If names are duplicated, it's difficult to determine which rows exactly covered our universe.
    private void checkRowNameValidity(List<MatrixRow> rows) throws IllegalArgumentException {
        List<String> names = new ArrayList<>();
        for (MatrixRow row : rows) {
            if (names.contains(row.valueLabel())) {
                throw new IllegalArgumentException("Duplicate named row " + row.valueLabel());
            }
            names.add(row.valueLabel());
        }
    }

    // Ensure that no columns have duplicated names, and, don't include 'HEADER'
    private void checkColumnNameValidity(List<MatrixColumn> columns) throws IllegalArgumentException {
        List<String> names = new ArrayList<>(Collections.singleton("HEADER"));
        for (MatrixColumn column : columns) {
            if (names.contains(column.constraintLabel())) {
                throw new IllegalArgumentException("Duplicate named column " + column.constraintLabel());
            }
            names.add(column.constraintLabel());
        }
    }

    /**
     * Return a sparse matrix representation of this matrix object.
     *
     * @return - A two-dimensional boolean array where the first dimension represents entire rows and the second the values for each column within aforementioned row.
     */
    public boolean[][] asSparseMatrix() {
        boolean[][] sparseMatrix = new boolean[rows.size()][columns.size()];

        for (int s = 0; s < rows.size(); s++) {
            sparseMatrix[s] = rows.get(s).values();
        }
        return sparseMatrix;
    }
}
```

The constraint checks should be understandable with the comments provided, however, the sparse matrix demands a 
further look.

```java
public boolean[][] asSparseMatrix() {
    boolean[][] sparseMatrix = new boolean[rows.size()][columns.size()];

    for (int s = 0; s < rows.size(); s++) {
       sparseMatrix[s] = rows.get(s).values();
    }
    return sparseMatrix;
}
```

A sparse matrix is a matrix where most of the values are zero. This is in comparison to a dense matrix where most of 
the values are one. In **this** context, I am using the term to mean, potentially inappropriately, "A matrix where the 
zeroes are preserved". 

<br>

The structure of this matrix is identical to the representation of our row and column objects from above. A two-dimensional 
array is easy to manipulate in the next step, which is why I opted for it. The first dimension of our array 
represents a row. The second represents a column space within that row. Recall that we are already storing the 
values of columns in our `MatrixRow` object, meaning that we can access them directly. First, we create a new 2D 
boolean array where the first dimension is the amount of rows, and, the second dimension is the number of columns. 
It's a matter of looping through the rows and injecting the rows value in the order which it appears. In the end, 
we're left with a 2D array of boolean values representing our columns and row values. To finalize this point, if we 
created an `ExactCoverMatrix` with these parameters:

```java
ExactCoverMatrix ecm = new ExactCoverMatrix(
    List.of(new MatrixColumn("Wallet"), new MatrixColumn("Keys"), new MatrixColumn("Phone")),
    List.of
    (new MatrixRow("1", new boolean[]{ true, false, true }), 
    new MatrixRow("2", new boolean[]{ true, true, true }), 
    new MatrixRow("3", new boolean[]{ false, false, false }))
);
```

The `boolean[][]` representation would be:

```
[
    [true, false, true], 
    [true, true, true], 
    [false, false, false]
]
```

### Dancing Links (Nodes?)

For Dancing Links to be successful, we must create a doubly linked list of nodes. This means that each node must 
keep track of the nodes to its left and right, as well as above and below. 
Further, there are different kinds of nodes. There are the nodes which make up the top row (column nodes) 
and nodes that make up the matrix itself (dancing nodes). We also need to be able to add new nodes to the matrix, 
and, temporarily cover, or hide, nodes. When reviewing the sample code I found online, I ran into the following 
general smells, in no order of importance:

1. Debugging was hard. If you wanted to generate a meaningful `toString` method to print your node state as console 
   output, and you defined an overridden `toString` method in the node class, this could cause a stack overflow 
   error if incorrectly implemented by recursively calling `toString` on the Left, Right, Up, and Down linked nodes, 
   which being doubly linked (end loops back to start), would be cyclical. The same behaviour was present if you 
   called a poorly implemented `equals`  method. 
2. Node instance variables were assigned to itself before the constructor returned. When we create a node, it is not 
   linked to anything. This means, being doubly linked, it should be linked to itself in all four directions. Many 
   implementations I saw assigned these values to `this` before the object was fully created. I don't have great 
   reasoning, but, I didn't like this approach. 
3. Nodes were allowed to link any kind of node in any direction, allowing for potentially inappropriate board states.
   Column nodes should only be allowed to link a column node left and right, and, dancing nodes up and down (except 
   when linking to itself).

<br>

With these in mind, I implemented the following solutions:

<br>

1. Use a generated ID that is guaranteed unique. This allows us to reference nodes by ID in `equals` and `toString`.
2. Use a static factory to ensure that the object state is completely initialized before assigning instance 
   variables to itself.
3. Use interfaces with generic types to govern how nodes can be linked.

<br>

#### The Node Types

I developed one abstract node type which permits two concrete implementations. Their signatures are:

```java
public abstract sealed class Node permits ColumnNode, DancingNode 

public final class ColumnNode extends Node implements DownLinkable<DancingNode>, RightLinkable<ColumnNode>

public final class DancingNode extends Node implements DownLinkable<DancingNode>, RightLinkable<DancingNode>
```

#### The Behaviours

Above, note that the two concrete node classes implement two interfaces. This is to address only certain 
subtypes of `Node` being "addable" in each direction. The interface definitions are as such:

```java
public interface RightLinkable<T extends Node> {
    T addRight(T n);
}

public interface DownLinkable<T extends Node> {
    T addBelow(T n) throws NodeException;
}
```

This is great because using the power of generics we can enforce column nodes to only allow right-linking other 
column nodes while also permitting down linking dancing nodes to build a grid. `DancingNode`'s are similarly 
constrained, only allowing other DancingNodes to be linked to itself either to the right, or down. 

**Node**

```java
package com.tajacks.algorithms.algxj.dlx.nodes;

import java.util.concurrent.atomic.AtomicLong;

public abstract sealed class Node permits ColumnNode, DancingNode {
    protected static final AtomicLong NEXT_ID  = new AtomicLong(0);
    protected final        long       id       = NEXT_ID.getAndIncrement();
    protected final        String     name;
    protected              Node       left;
    protected              Node       right;
    protected              Node       up;
    protected              Node       down;
    private                int        hashCode = -1;

    protected Node(String name) {
        this.name = name;
    }

    protected void removeSelfLeftRight() {
        this.left.setRight(this.right);
        this.right.setLeft(this.left);
    }

    protected void restoreSelfLeftRight() {
        this.left.setRight(this);
        this.right.setLeft(this);
    }

    protected void removeSelfUpDown() {
        this.up.setDown(this.down);
        this.down.setUp(this.up);
    }

    protected void restoreSelfUpDown() {
        this.up.setDown(this);
        this.down.setUp(this);
    }

    protected void linkToSelf() {
        this.up = this.down = this.left = this.right = this;
    }

    public abstract ColumnNode assignedColumn();


    public long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public Node getLeft() {
        return left;
    }

    protected void setLeft(Node left) {
        this.left = left;
    }

    public Node getRight() {
        return right;
    }

    protected void setRight(Node right) {
        this.right = right;
    }

    public Node getUp() {
        return up;
    }

    protected void setUp(Node up) {
        this.up = up;
    }

    public Node getDown() {
        return down;
    }

    protected void setDown(Node down) {
        this.down = down;
    }

    @Override
    public int hashCode() {
        // Lazy initialize HashCode
        if (this.hashCode == -1) {
            this.hashCode = Long.hashCode(id);
        }
        return hashCode;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Node node = (Node) o;
        return node.id == this.id;
    }

    @Override
    public String toString() {
        return name;
    }
}
```

The above represents our Node superclass from which ColumnNode and DancingNode extend. This class implements a fair 
amount of the logic required to solve exact covers. Here is a breakdown of the important bits.

```java
protected static final AtomicLong NEXT_ID  = new AtomicLong(0);
protected final        long       id       = NEXT_ID.getAndIncrement();
protected final        String     name;
protected              Node       left;
protected              Node       right;
protected              Node       up;
protected              Node       down;
private                int        hashCode = 0;
```

The `id` field is used to assign a unique ID to each node by using an `AtomicLong`. Atomicity is important here to 
ensure that no duplicate IDs are created. This is followed by a friendly name field and 4 directional fields, 
representing the nodes connected to this node in each direction. Finally, I have a hashcode field which has an 
initial value of `0`. This will become clearer later.

```java
protected Node(String name) {
  this.name = name;
}
```

The constructor that is the same for every node type is that each node type requires a name. This allows the clients 
to input their own identifiers and make sense of them later. For example, a client using this to solve sudoku 
puzzles may create a row with the name "(1,2,3)" meaning row 1, column 2, number 3.

```java
protected void removeSelfLeftRight() {
  this.left.setRight(this.right);
  this.right.setLeft(this.left);
}

protected void restoreSelfLeftRight() {
  this.left.setRight(this);
  this.right.setLeft(this);
}

protected void removeSelfUpDown() {
  this.up.setDown(this.down);
  this.down.setUp(this.up);
}

protected void restoreSelfUpDown() {
  this.up.setDown(this);
  this.down.setUp(this);
}
```

The above four methods are quite important to implementing the "cover" and "uncover" methods. As seen here, if a 
node wants to remove itself left and right, it simply tells its neighbours on either side that their neighbour is 
each other, in the proper direction. By doing it this way, the node remains in the know of where it was removed from,
but, from the perspective of the remaining nodes- in the row it as if it was removed. This is formalized by 
Wikipedia as:

```
x.left.right ← x.right;
x.right.left ← x.left;

will remove node x from the list, while:

x.left.right ← x;
x.right.left ← x;

will restore x's position in the list
```

Moving on ...

```java
protected void linkToSelf() {
  this.up = this.down = this.left = this.right = this;
}
```

When there is a single node in the list, the nodes left, right, up, and down mappings should all be to itself. The 
above method accomplishes that.

```java
public abstract ColumnNode assignedColumn();
```

It is important for a node to have reference to the column it belongs to. While we could introduce an instance 
variable of `ColumnNode` to all `Node` subtypes, this would be a bit cyclical for ColumnNodes, as they would need to 
carry a reference to themselves. By declaring this `abstract`, we can let the subtype define how they want to return 
which ColumnNode they belong to.

```java
@Override
final public int hashCode() {
   // Lazy initialize HashCode
   if (this.hashCode == 0) {
      this.hashCode = Long.hashCode(id);
   }
   return hashCode;
}

@Override
final public boolean equals(Object o) {
  if (this == o) {
      return true;
  }
  if (o == null || getClass() != o.getClass()) {
      return false;
  }
  Node node = (Node) o;
  return node.id == this.id;
}

@Override
final public String toString() {
  return name;
}
```

Omitting getters and setters, the remainder of the code is boilerplate with some minor adjustments. Both the 
Hashcode and Equals method rely exclusively on the atomic ID field to evaluate equality, and the hashcode method is 
lazy initialized the first time it is called. The `toString` method simply returns the name. These overrides are 
appropriate for subclasses of the node objects and are declared final.

**ColumnNode**

```java
package com.tajacks.algorithms.algxj.dlx.nodes;

import com.tajacks.algorithms.algxj.dlx.exception.IllegalNodeColumnException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class ColumnNode extends Node implements DownLinkable<DancingNode>, RightLinkable<ColumnNode> {
    private int     nodesWithinColumn;
    private boolean covered;

    private ColumnNode(String name) {
        super(name);
        this.nodesWithinColumn = 0;
    }

    public static ColumnNode fromName(String name) {
        ColumnNode columnNode = new ColumnNode(name);
        columnNode.linkToSelf();
        return columnNode;
    }

    public void cover() {
        removeSelfLeftRight();
        for (Node colNode : getNodesInColumn(NodeOrder.NATURAL)) {
            for (Node colNodeRowNode : getNodesInRowGivenNode(colNode, NodeOrder.NATURAL)) {
                colNodeRowNode.removeSelfUpDown();
                colNodeRowNode.assignedColumn().decrementDancingNodeCount();
            }
        }
        covered = true;
    }

    public void uncover() {
        for (Node colNode : getNodesInColumn(NodeOrder.REVERSED)) {
            for (Node colNodeRowNode : getNodesInRowGivenNode(colNode, NodeOrder.REVERSED)) {
                colNodeRowNode.restoreSelfUpDown();
                colNodeRowNode.assignedColumn().incrementDancingNodeCount();
            }
        }
        restoreSelfLeftRight();
        covered = false;
    }
    
    private List<Node> getNodesInColumn(NodeOrder orderBy) {
        List<Node> nodes = new ArrayList<>();
        for (Node i = this.down; i != this; i = i.down) {
            nodes.add(i);
        }
        if (orderBy.equals(NodeOrder.REVERSED)) {
            Collections.reverse(nodes);
        }
        return nodes;
    }

    private List<Node> getNodesInRowGivenNode(Node givenNode, NodeOrder orderBy) {
        List<Node> nodes = new ArrayList<>();
        for (Node i = givenNode.right; i != givenNode; i = i.right) {
            nodes.add(i);
        }
        if (orderBy.equals(NodeOrder.REVERSED)) {
            Collections.reverse(nodes);
        }
        return nodes;
    }

    public void incrementDancingNodeCount() {
        nodesWithinColumn++;
    }

    public void decrementDancingNodeCount() {
        nodesWithinColumn--;
    }

    public int getNodesWithinColumn() {
        return nodesWithinColumn;
    }

    public void setNodesWithinColumn(int nodesWithinColumn) {
        this.nodesWithinColumn = nodesWithinColumn;
    }

    public boolean isCovered() {
        return covered;
    }

    @Override
    public DancingNode addBelow(DancingNode n) throws IllegalNodeColumnException {
        if (n.assignedColumn() != this) {
            throw new IllegalNodeColumnException("Cannot down-link node " + n + " to column " + this.id + ". Outside column boundary.");
        }

        n.down    = this.down;
        n.down.up = n;
        n.up      = this;
        this.down = n;
        return n;
    }

    @Override
    public ColumnNode addRight(ColumnNode n) {
        n.right      = this.right;
        n.right.left = n;
        n.left       = this;
        this.right   = n;
        return n;
    }

    @Override
    public ColumnNode assignedColumn() {
        return this;
    }

    private enum NodeOrder {
        NATURAL,
        REVERSED
    }
}
```

The above represents the entirety of the ColumnNode class, the below is a breakdown.

```java
private int     nodesWithinColumn;
private boolean covered;

private ColumnNode(String name) {
  super(name);
  this.nodesWithinColumn = 0;
}
```

The ColumnNode specifically needs to keep track of how many nodes are in the column that it represents. I have also 
included a boolean flag `covered` which holds the current state of the node, covered or uncovered. The private 
constructor sets the nodes within the column to zero, and assigns the name.

```java
public static ColumnNode fromName(String name) {
  ColumnNode columnNode = new ColumnNode(name);
  columnNode.linkToSelf();
  return columnNode;
}
```

The constructor is private as all initialization is done via a public static factory, above. This was chosen to 
ensure that nodes can fully link to themselves after the constructor has returned, but before the object is returned 
to the caller. 

```java
public void cover() {
  removeSelfLeftRight();
  for (Node colNode : getNodesInColumn(NodeOrder.NATURAL)) {
      for (Node colNodeRowNode : getNodesInRowGivenNode(colNode, NodeOrder.NATURAL)) {
          colNodeRowNode.removeSelfUpDown();
          colNodeRowNode.assignedColumn().decrementDancingNodeCount();
      }
  }
  covered = true;
}

public void uncover() {
  for (Node colNode : getNodesInColumn(NodeOrder.REVERSED)) {
      for (Node colNodeRowNode : getNodesInRowGivenNode(colNode, NodeOrder.REVERSED)) {
          colNodeRowNode.restoreSelfUpDown();
          colNodeRowNode.assignedColumn().incrementDancingNodeCount();
      }
  }
  restoreSelfLeftRight();
  covered = false;
}

  private List<Node> getNodesInColumn(NodeOrder orderBy) {
  List<Node> nodes = new ArrayList<>();
  for (Node i = this.down; i != this; i = i.down) {
      nodes.add(i);
  }
  if (orderBy.equals(NodeOrder.REVERSED)) {
      Collections.reverse(nodes);
  }
  return nodes;
}

private List<Node> getNodesInRowGivenNode(Node givenNode, NodeOrder orderBy) {
  List<Node> nodes = new ArrayList<>();
  for (Node i = givenNode.right; i != givenNode; i = i.right) {
      nodes.add(i);
  }
  if (orderBy.equals(NodeOrder.REVERSED)) {
      Collections.reverse(nodes);
  }
  return nodes;
}
```

The `cover()` and `uncover()` methods are critical. Walking through the cover method, the first thing to happen is 
that the column node removes references to itself left and right. As far as the neighbours are concerned, it's gone. 
After this, we call a helper method `getNodesInColumn` which provides us a list of Nodes within the column that 
this `ColumnNode` represents. The ordering here is important as the Dancing Links paper specifies that when uncovering 
a column, it must happen in the opposite order as it was covered. Effectively, uncovering in the reverse order in 
which it was covered. `getNodesInColumn` accomplishes this by looping through all downward linked nodes, adding it to 
a temporary list, and then returning this list. Because the list is doubly linked, it repeats this process only as 
long as the next downward linked node is not equal to the column node itself. Now that we have a list of nodes in 
the column, for each of those nodes, remove them from their respective column and decrement the node count in said 
column. This is accomplished in a similar manner, but instead of moving downwards from the column, it moves right 
from the `DancingNode`. When we call `uncover()`, we call it with the `NodeOrder` type of `REVERSED`, which simply 
reverses the collection, allowing us to process the results in the opposite order from which we originally processed 
them.

```java
@Override
public DancingNode addBelow(DancingNode n) throws IllegalNodeColumnException {
  if (n.assignedColumn() != this) {
      throw new IllegalNodeColumnException("Cannot down-link node " + n + " to column " + this.id + ". Outside column boundary.");
  }

  n.down    = this.down;
  n.down.up = n;
  n.up      = this;
  this.down = n;
  return n;
}

@Override
public ColumnNode addRight(ColumnNode n) {
  n.right      = this.right;
  n.right.left = n;
  n.left       = this;
  this.right   = n;
  return n;
}

@Override
public ColumnNode assignedColumn() {
  return this;
}
```

The final interesting bit from the `ColumnNode` class is the interface and abstract method implementations. As 
demonstrated above, the type of the interface implementation allows for only DancingNodes to be added below, and, 
only ColumnNodes to be added to the right. As for the assigned column, it simply refers to itself.

<br>

The action of adding a node to the right, or down, is a matter of updating the right and left references as if it 
was added directly to the right of the existing node. For example, to add a ColumnNode `n` to the right, we set 
`n`'s right to be our old value of right. We set `n`'s right, leftwards neighbour to be `n` itself. We set `n`'s 
leftwards neighbour to be the node to which we are adding to the right of. Then we update our own positions so that 
our right value is now `n`. A similar process is repeated for adding a node below.

**DancingNode**

```java
package com.tajacks.algorithms.algxj.dlx.nodes;

import com.tajacks.algorithms.algxj.dlx.exception.IllegalNodeColumnException;

public final class DancingNode extends Node implements DownLinkable<DancingNode>, RightLinkable<DancingNode> {
    private final ColumnNode column;

    private DancingNode(ColumnNode c, String name) {
        super(name);
        this.column = c;
    }

    public static DancingNode createWithinColumn(ColumnNode column, String name) {
        DancingNode dancingNode = new DancingNode(column, name);
        dancingNode.linkToSelf();
        dancingNode.column.incrementDancingNodeCount();
        return dancingNode;
    }

    @Override
    public DancingNode addBelow(DancingNode n) {
        if (n.assignedColumn() != column) {
            throw new IllegalNodeColumnException("Cannot down-link node " + n + " to column " + column + " outside column boundary.");
        }
        n.down    = this.down;
        n.down.up = n;
        n.up      = this;
        this.down = n;
        return n;
    }

    @Override
    public ColumnNode assignedColumn() {
        return column;
    }

    @Override
    public DancingNode addRight(DancingNode n) {
        n.right      = this.right;
        n.right.left = n;
        n.left       = this;
        this.right   = n;
        return n;
    }
}
```

The majority of the `DancingNode`'s implementation is inherited from `Node`. The following are the major differences:

```java
private final ColumnNode column;

private DancingNode(ColumnNode c, String name) {
  super(name);
  this.column = c;
}

public static DancingNode createWithinColumn(ColumnNode column, String name) {
  DancingNode dancingNode = new DancingNode(column, name);
  dancingNode.linkToSelf();
  dancingNode.column.incrementDancingNodeCount();
  return dancingNode;
}
```

The `DancingNode` maintains an instance variable of type `ColumnNode` to track which column it belongs to. 
Construction takes a name (to identify this node) and the column to which it belongs to. Similar to the ColumnNode, 
in order to ensure that the object links to itself after the constructor returns, the constructor is private and a 
static factory method takes care of construction, linking to self, incrementing the dancing node count in the column,
and finally returning our newly created node.

```java
@Override
public ColumnNode assignedColumn() {
  return column;
}
```

The final difference in this class, except for type differences in the implemented interfaces, is that instead of 
returning a pointer to itself like the `ColumnNode` did, `assignedColumn()` now returns which column this 
`DancingNode` belongs to.

The magic of Dancing Links happens within the `DLXBoard` class. The full class is below:

```java 
package com.tajacks.algorithms.algxj.dlx;

import com.tajacks.algorithms.algxj.dlx.nodes.ColumnNode;
import com.tajacks.algorithms.algxj.dlx.nodes.DancingNode;
import com.tajacks.algorithms.algxj.dlx.nodes.Node;
import com.tajacks.algorithms.algxj.matrix.ExactCoverMatrix;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;

public class DLXBoard {
    private static final String           HEADER_LABEL = "HEADER";
    private final        ColumnNode       header;
    private final        ExactCoverMatrix matrix;
    private final        List<ColumnNode> columns;
    private final        List<Node>       currentAnswer;
    private              List<List<Node>> answers;

    public DLXBoard(ExactCoverMatrix matrix) {
        this.header        = ColumnNode.fromName(HEADER_LABEL);
        this.matrix        = matrix;
        this.columns       = buildColumnsAndNodes();
        this.currentAnswer = new ArrayList<>();
    }

    private List<ColumnNode> buildColumnsAndNodes() {
        List<ColumnNode> columns = new ArrayList<>();

        for (int i = matrix.columns().size() - 1; i >= 0; i--) {
            ColumnNode node = ColumnNode.fromName(matrix.columns().get(i).constraintLabel());
            header.addRight(node);
            columns.add(0, node);
        }

        boolean[][] sparseMatrix = matrix.asSparseMatrix();

        for (int o = sparseMatrix.length - 1; o >= 0; o--) {
            DancingNode lastAddedNode = null;
            for (int i = 0; i < columns.size(); i++) {
                if (sparseMatrix[o][i]) {
                    ColumnNode  columnNode = columns.get(i);
                    DancingNode newNode    = DancingNode.createWithinColumn(columnNode, matrix.rows().get(o).valueLabel());
                    if (lastAddedNode == null) {
                        lastAddedNode = newNode;
                    }
                    columnNode.addBelow(newNode);
                    lastAddedNode = lastAddedNode.addRight(newNode);
                }
            }
        }
        header.setNodesWithinColumn(columns.size());
        return columns;
    }

    public List<List<Node>> attemptSolve() {
        // Lazy load / Cache Answer
        if (this.answers != null) {
            return answers;
        }
        this.answers = new ArrayList<>();

        // Create a bucket to pass to solve method to store current solution.
        List<Node> currentAnswerBucket = new ArrayList<>();
        solve(currentAnswerBucket);
        return answers;
    }

    private void solve(List<Node> currentAnswerBucket) {
        if (header.getRight() != header) {
            Optional<ColumnNode> c = getColumnWithLowestNodes();

            if (c.isPresent()) {
                ColumnNode co = c.get();
                co.cover();

                for (Node node = co.getDown(); node != co; node = node.getDown()) {
                    // Add Node to partial solution
                    currentAnswerBucket.add(node);

                    // Cover columns from Nodes in row
                    for (Node j = node.getRight(); j != node; j = j.getRight()) {
                        j.assignedColumn().cover();
                    }

                    // Recursive call to solve
                    solve(currentAnswerBucket);

                    // Start to undo actions taken
                    node = currentAnswerBucket.remove(currentAnswerBucket.size() - 1);
                    co   = node.assignedColumn();

                    // Uncover previously covered columns
                    for (Node j = node.getLeft(); j != node; j = j.getLeft()) {
                        j.assignedColumn().uncover();
                    }
                }
                co.uncover();
            }
        } else {
            answers.add(new ArrayList<>(currentAnswerBucket));
        }
    }

    private Optional<ColumnNode> getColumnWithLowestNodes() {
        return columns.stream()
                      .filter(Predicate.not(ColumnNode::isCovered))
                      .min(Comparator.comparingInt(ColumnNode::getNodesWithinColumn));
    }
}
```

Starting with construction:

```java
public DLXBoard(ExactCoverMatrix matrix) {
  this.header        = ColumnNode.fromName(HEADER_LABEL);
  this.matrix        = matrix;
  this.columns       = buildColumnsAndNodes();
  this.currentAnswer = new ArrayList<>();
}
```

The first action taken when initializing a new `DLXBoard` is to create a special `ColumnNode` which will be referred 
to as the 'Header'. The header node will initialize the grid and keep track of the state of all other ColumnNodes. 
The board keeps an instance variable `List<ColumnNode> columns` which represents the grid. It is unnecessary to 
store any reference to "rows", as they can be determined from the columns `DancingNode`'s. The call to 
`buildColumnsAndNodes()` is also part of the constructor:

```java
private List<ColumnNode> buildColumnsAndNodes() {
  List<ColumnNode> columns = new ArrayList<>();

  for (int i = matrix.columns().size() - 1; i >= 0; i--) {
      ColumnNode node = ColumnNode.fromName(matrix.columns().get(i).constraintLabel());
      header.addRight(node);
      columns.add(0, node);
  }

  boolean[][] sparseMatrix = matrix.asSparseMatrix();

  for (int o = sparseMatrix.length - 1; o >= 0; o--) {
      DancingNode lastAddedNode = null;
      for (int i = 0; i < columns.size(); i++) {
          if (sparseMatrix[o][i]) {
              ColumnNode  columnNode = columns.get(i);
              DancingNode newNode    = DancingNode.createWithinColumn(columnNode, matrix.rows().get(o).valueLabel());
              if (lastAddedNode == null) {
                  lastAddedNode = newNode;
              }
              columnNode.addBelow(newNode);
              lastAddedNode = lastAddedNode.addRight(newNode);
          }
      }
  }
  header.setNodesWithinColumn(columns.size());
  return columns;
}
```

`buildColumnsAndNodes` starts by initializing an empty `ArrayList<ColumnNode>` to hold our generated board. Recall, 
that if we add to the right of a node, we effectively bump the node that was previously directly to the right by one 
spot, to the right. For this reason, to preserve column ordering, `i` is initialized at the last index in our list 
containing columns, and, is decremented towards the start of the list. This ensures that the last item in the list 
is also the last item in our doubly linked list. The `fori` loop iterates through our list of columns, creating a 
column node representing it, and adds it to our list of columns to be returned. Following this, we generate a sparse 
matrix using aforementioned methods and loop through each row. For each row in the sparse matrix, iterate through each 
value. For each value, if that value is `true` (representing a node should be in this position), create a new 
`DancingNode` and add it within the column that is currently being iterated through. We assign it the same name as 
was provided in the `MatrixRow` There is a placeholder `lastAddedNode` which is initially `null` to keep track of 
the last added node. If this is the first time we're creating a `DancingNode` in this loop, after we create it, we 
assign this node as the last added node and continue. Next, we need to link this node beneath the last node in the 
current column. Recall that we are decrementing the value of `o` which represents the row position. This is 
important as it means we're starting with the last value in the column, pushing it downwards each time we add 
another node. An illustration helps with this:

```
Matrix:

0) ColumnNode
1) true
2) false 
3) false

Pseducode Loop:
fori loop, i = 3, i-- {
   ColumnNode.addBelow(row.get(i));
}

Results In: 

First Iteration:

0) ColumnNode
1) false

Second Iteration:

0) ColumnNode
1) false
2) false <-- Position 1 from First Iteration

Third Iteration:

0) ColumnNode
1) true
2) false <-- Position 1 from Second Iteration
3) false <-- Position 1 from First Iteration
```

The last logic in the iteration is to right-link the new node to the previously added node. This forms a row. The 
first time this happens, it effectively right links to itself, due to the requirement of the list being doubly 
linked. The final piece of creating the board is to set the total number of columns in the header node as being the 
total number of columns (since none start covered) using `header. setNodesWithinColumn(columns.size());`. 
Finally, we can attempt to solve (attempt, as it may be unsolvable):

```java
public List<List<Node>> attemptSolve() {
  // Lazy load / Cache Answer
  if (this.answers != null) {
      return answers;
  }
  this.answers = new ArrayList<>();

  // Create a bucket to pass to solve method to store current solution.
  List<Node> currentAnswerBucket = new ArrayList<>();
  solve(currentAnswerBucket);
  return answers;
}

private void solve(List<Node> currentAnswerBucket) {
  if (header.getRight() != header) {
      Optional<ColumnNode> c = getColumnWithLowestNodes();

      if (c.isPresent()) {
          ColumnNode co = c.get();
          co.cover();

          for (Node node = co.getDown(); node != co; node = node.getDown()) {
              // Add Node to partial solution
              currentAnswerBucket.add(node);

              // Cover columns from Nodes in row
              for (Node j = node.getRight(); j != node; j = j.getRight()) {
                  j.assignedColumn().cover();
              }

              // Recursive call to solve
              solve(currentAnswerBucket);

              // Start to undo actions taken
              node = currentAnswerBucket.remove(currentAnswerBucket.size() - 1);
              co   = node.assignedColumn();

              // Uncover previously covered columns
              for (Node j = node.getLeft(); j != node; j = j.getLeft()) {
                  j.assignedColumn().uncover();
              }
          }
          co.uncover();
      }
  } else {
      answers.add(new ArrayList<>(currentAnswerBucket));
  }
}

private Optional<ColumnNode> getColumnWithLowestNodes() {
  return columns.stream()
                .filter(Predicate.not(ColumnNode::isCovered))
                .min(Comparator.comparingInt(ColumnNode::getNodesWithinColumn));
}
```

That's a lot. Here's just the `attemptSolve` method:

```java
public List<List<Node>> attemptSolve() {
  // Lazy load / Cache Answer
  if (this.answers != null) {
      return answers;
  }
  this.answers = new ArrayList<>();

  // Create a bucket to pass to solve method to store current solution.
  List<Node> currentAnswerBucket = new ArrayList<>();
  solve(currentAnswerBucket);
  return answers;
}
```

Because the board itself is immutable, we can cache the answer should it need to be retrieved later. This saves CPU 
cycles from re-running the completion algorithm because the answer, or lack thereof, will never change. 
For this reason, if the answer is not `null`, it must have been already computed, and we can return the already computed 
answer. Otherwise, we assign answers as an empty `ArrayList<Node>`, to be populated later. We also create a bucket to hold 
potential answers during the solve which is also an `ArrayList<Node>`. This is passed into the method. As per the 
algorithm specification, solving is improved if we start with the column containing the lowest number of nodes. A 
simple helper method takes the columns as a stream, filters OUT the covered columns (by using static `Predicate.not` 
to reverse the logic), and then finds the column with the lowest value of `nodesWithinColumn`.

```java
private Optional<ColumnNode> getColumnWithLowestNodes() {
  return columns.stream()
                .filter(Predicate.not(ColumnNode::isCovered))
                .min(Comparator.comparingInt(ColumnNode::getNodesWithinColumn));
}
```

Now we can break down the solve method itself. Here's a refresher:

```java
private void solve(List<Node> currentAnswerBucket) {
  if (header.getRight() != header) {
      Optional<ColumnNode> c = getColumnWithLowestNodes();

      if (c.isPresent()) {
          ColumnNode co = c.get();
          co.cover();

          for (Node node = co.getDown(); node != co; node = node.getDown()) {
              // Add Node to partial solution
              currentAnswerBucket.add(node);

              // Cover columns from Nodes in row
              for (Node j = node.getRight(); j != node; j = j.getRight()) {
                  j.assignedColumn().cover();
              }

              // Recursive call to solve
              solve(currentAnswerBucket);

              // Start to undo actions taken
              node = currentAnswerBucket.remove(currentAnswerBucket.size() - 1);
              co   = node.assignedColumn();

              // Uncover previously covered columns
              for (Node j = node.getLeft(); j != node; j = j.getLeft()) {
                  j.assignedColumn().uncover();
              }
          }
          co.uncover();
      }
  } else {
      answers.add(new ArrayList<>(currentAnswerBucket));
  }
}
```

The first action to take is to check if the node to the right of the header is also the header itself. If this is 
the case, considering our doubly linked list, we know that all columns must be covered, meaning that we have arrived 
at an answer. If this is true, we add to our answers the contents of the current answer bucket. It is very important 
that we do not add the bucket itself, as the state of the bucket is manipulated as the solve method proceeds. For 
this reason, the list we add to `answers` is a new `ArrayList<Node>`, created from the current answer bucket.

If, the header's right-linked Node is not itself, that means that there are columns to evaluate. First, we get the 
column with the lowest number of nodes, not including the header, using the aforementioned helper method. Next, we 
cover that column. For each node in that column, we take the following actions:
<br>

1. Add it to the partial solution
2. Cover the columns for each other node within the same **row**
3. Recursively call this method
   <br>

As the method gets called recursively, more columns get covered and more nodes are added to the partial solution. 
The beauty of the recursion is that if a scenario is such that on the first iteration, a node is added to the 
partial solution, and during the second (or Nth) iteration, columns still exist yet are invalid (e.x. don't contain 
nodes) for the solution, the algorithm backs out the additions to the `currentAnswerBucket` by removing the node at the 
last position in the list (one node added per recursive call). It then continues to uncover previously covered nodes 
and columns. A partial answer is ONLY added to the answer list if no columns exist at the end of the recursion. 
The recursive back-out continues for each node in the column that was originally chosen as the start column.
<br>

Once this procedure is entirely exhausted and there are no more combinations to compute, `attemptSolve` returns the 
`ArrayList<> answers`. If no answers can be found, `answers` is empty. Otherwise, it contains a list of each set of 
answers represented by the `DancingNode` names. The unit tests can demonstrate this:

<br>

---

<br>

_From the GitHub README:_

```java
ExactCoverMatrix ecm = new ExactCoverMatrix(
       List.of(new MatrixColumn("Wallet"), new MatrixColumn("Keys"), new MatrixColumn("Phone")),
       List.of(
               new MatrixRow("1", new boolean[]{ true, false, true }),
               new MatrixRow("2", new boolean[]{ true, true, false }),
               new MatrixRow("3", new boolean[]{ false, false, false }),
               new MatrixRow("4", new boolean[]{ false, true, false }),
               new MatrixRow("5", new boolean[]{ true, true, true })
       )
);
DLXBoard         b       = new DLXBoard(ecm);
List<List<Node>> results = b.attemptSolve();
```
<br>

Results in:

```[[1, 4], [5]]```

<br>

---

<br>

## Conclusion

In conclusion, I am medium-happy with how this implementation turned out. It took going through and doing it myself 
before the magic of Dancing Links really stuck, and, I already see room for improvement in this codebase. I believe 
I will write it in Kotlin next and implement a Sudoku solver as well, potentially to be used as part of a Sudoku 
game using their multiplatform framework. Hopefully seeing the classes laid out and explained piece by piece also 
helped you understand Dancing Links. Please feel free to use any of the code as per the licence constraints in 
[GitHub](https://github.com/tajacks/algx-j){:target="_blank"}. 