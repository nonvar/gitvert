<p align="center">
  <img src="/vergit.png" alt="vergit logo" width="120" />
</p>

<h1 align="center">&lt; vergit &gt;</vergit></h1>

<h2 align="center">&lt; time machine for git &gt;</vergit></h2>

`vergit` is an interactive CLI tool to help you navigate your Git commit history with ease. Undo, select, or pull the latest commits safely using a simple menu-driven interface.

---

## Features

- Undo: Go back one commit easily  
- Select: Pick a commit from recent history  
- Redo: Pull the latest changes from remote  
- Handles uncommitted changes safely (stash, cancel, or hard reset)  
- Creates a backup branch before any hard reset  

---

## Installation (Local Testing)

To install `vergit` locally for testing:

```bash
git clone https://github.com/yourusername/vergit.git
cd vergit
npm install
npm link
```

---

## Usage

On any project, run the command:

```
vergit
```

---

## Notes
- This tool performs git reset commands under the hood—be cautious with hard resets as they discard local changes.
- Stashing saves your uncommitted changes safely for later restoration (`git stash pop`).
- A backup branch is created automatically before any hard reset for recovery.

---

## Contributing

Feel free to open issues or submit pull requests to improve vergit!

---

<h2 align="center">&lt; happy versioning &gt;</vergit></h2>
