#!/usr/bin/env node

const inquirer = require('inquirer');
const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const prompt = inquirer.default || inquirer;

const git = simpleGit();
const VERGIT_DIR = '.vergit';
const STACK_FILE = 'stack.json';
const MAX_STACK_SIZE = 20;

// Format timestamp as YYYY-MM-DD_HH-MM-SS
function getFormattedTimestamp() {
  const now = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const Y = now.getFullYear();
  const M = pad(now.getMonth() + 1);
  const D = pad(now.getDate());
  const h = pad(now.getHours());
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  return `${Y}-${M}-${D}_${h}-${m}-${s}`;
}

function getStackFilePath() {
  const dir = path.join(process.cwd(), VERGIT_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, STACK_FILE);
}

function loadStack() {
  const file = getStackFilePath();
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return [];
    }
  }
  return [];
}

function saveStack(stack) {
  fs.writeFileSync(getStackFilePath(), JSON.stringify(stack, null, 2));
}

async function confirmPrompt(message) {
  const { confirm } = await prompt.prompt({
    type: 'confirm',
    name: 'confirm',
    message,
    default: false
  });
  return confirm;
}

async function promptResetMode(hasUncommitted) {
  if (hasUncommitted) {
    console.log('\n⚠️  Uncommitted changes detected:');
    const status = await git.status();
    status.files.forEach(f => console.log('  - ' + f.path));

    const { safety } = await prompt.prompt({
      type: 'list',
      name: 'safety',
      message: 'How do you want to handle uncommitted changes?',
      choices: [
        { name: 'Save changes for later (stash)', value: 'stash' },
        { name: '❌ Cancel', value: 'abort' },
        { name: 'Delete local changes (hard reset)', value: 'hard' }
      ],
      default: 0
    });

    if (safety === 'stash') {
      await git.stash();
      console.log('Changes stashed. Use "git stash pop" to restore.');
      return '--soft';
    }
    if (safety === 'abort') {
      return null; // Cancel without exit
    }
    if (safety === 'hard') {
      console.log('⚠️ Proceeding with HARD reset! Local changes will be lost!');
      return '--hard';
    }
  } else {
    const { mode } = await prompt.prompt({
      type: 'list',
      name: 'mode',
      message: 'Choose reset mode:',
      choices: [
        { name: 'Safe (keep changes)', value: '--soft' },
        { name: 'Hard (discard changes)', value: '--hard' }
      ],
      default: 0
    });
    return mode;
  }
}

// Parse timestamp from branch name like "vergit-backup-2025-07-22_15-30-00"
function parseTimestamp(branchName) {
  const prefix = 'vergit-backup-';
  if (!branchName.startsWith(prefix)) return null;
  return branchName.slice(prefix.length);
}

async function listBackupBranches() {
  const branches = await git.branchLocal();
  return branches.all.filter(name => name.startsWith('vergit-backup-'));
}

async function showBackupsMenu() {
  let backupBranches = await listBackupBranches();
  if (backupBranches.length === 0) {
    console.log('No backup branches found.');
    return;
  }

  while (true) {
    console.log('\nBackup branches:');
    // Show branches with parsed timestamp
    backupBranches.forEach(branch => {
      const ts = parseTimestamp(branch);
      console.log(`  - ${branch} (${ts || 'unknown'})`);
    });

    const { action } = await prompt.prompt({
      type: 'list',
      name: 'action',
      message: 'What do you want to do with backup branches?',
      choices: [
        { name: 'Restore a backup branch', value: 'restore' },
        { name: 'Delete backup branches', value: 'delete' },
        { name: 'Go back to main menu', value: 'back' }
      ]
    });

    if (action === 'back') return;

    if (action === 'restore') {
      const { toRestore } = await prompt.prompt({
        type: 'list',
        name: 'toRestore',
        message: 'Select a backup branch to restore:',
        choices: backupBranches
      });

      const confirm = await confirmPrompt(`Checkout backup branch '${toRestore}'?`);
      if (confirm) {
        try {
          await git.checkout(toRestore);
          console.log(`Checked out backup branch '${toRestore}'.`);
          return; // Return to main menu after checkout
        } catch (e) {
          console.error('Failed to checkout branch:', e.message || e);
        }
      } else {
        console.log('Cancelled restoring branch.');
      }
    } else if (action === 'delete') {
      const { toDelete } = await prompt.prompt({
        type: 'checkbox',
        name: 'toDelete',
        message: 'Select backup branches to delete:',
        choices: backupBranches
      });

      if (toDelete.length === 0) {
        console.log('No backups selected for deletion.');
        continue; // Loop back
      }

      const confirm = await confirmPrompt(`Delete ${toDelete.length} backup branch(es)? This cannot be undone.`);
      if (confirm) {
        for (const branch of toDelete) {
          try {
            await git.deleteLocalBranch(branch, true);
            console.log(`Deleted backup branch: ${branch}`);
            const idx = backupBranches.indexOf(branch);
            if (idx > -1) backupBranches.splice(idx, 1);
          } catch (e) {
            console.warn(`Failed to delete branch ${branch}:`, e.message || e);
          }
        }
        if (backupBranches.length === 0) {
          console.log('All backups deleted.');
          return;
        }
      } else {
        console.log('Deletion cancelled.');
      }
    }
  }
}

async function createBackupBranch(currentHash) {
  const backupBranch = `vergit-backup-${getFormattedTimestamp()}`;
  try {
    const branches = await git.branchLocal();
    if (!branches.all.includes(backupBranch)) {
      await git.branch([backupBranch, currentHash]);
      console.log(`Backup branch '${backupBranch}' created for safety.`);
    }
  } catch (e) {
    console.warn('Failed to create backup branch:', e.message || e);
  }
}

async function main() {
  console.log('< vergit >\n');

  let stack = loadStack();

  while (true) {
    try {
      const choices = [
        { name: 'Undo: Previous commit', value: 'undo' },
        { name: 'Select a commit', value: 'select' },
        { name: 'Manage backup branches', value: 'manage-backups' },
        { name: 'Redo: Latest remote commit (git pull)', value: 'redo' },
        { name: 'Exit', value: 'exit' }
      ];

      const { action } = await prompt.prompt({
        type: 'list',
        name: 'action',
        message: 'Choose an action:',
        choices
      });

      if (action === 'exit') {
        console.log('< goodbye >');
        process.exit(0);
      }

      if (action === 'manage-backups') {
        await showBackupsMenu();
        continue; // back to main menu
      }

      if (action === 'redo') {
        console.log('Pulling from remote...');
        await git.pull();
        console.log('Up to date.');
        continue;
      }

      let commitHash, messagePreview;

      if (action === 'undo') {
        const log = await git.log({ maxCount: 2 });
        if (log.all.length < 2) {
          console.log('No previous commit.');
          continue;
        }
        commitHash = log.all[1].hash;
        messagePreview = `${commitHash.slice(0, 7)} | ${log.all[1].date.slice(0, 10)} | ${log.all[1].message}`;
      } else if (action === 'select') {
        const log = await git.log({ maxCount: 15 });
        const selectChoices = [
          { name: '❌ Cancel', value: null },
          ...log.all.map(c => ({
            name: `${c.hash.slice(0, 7)} | ${c.date.slice(0, 10)} | ${c.message}`,
            value: c.hash
          }))
        ];

        const { commitHash: selectedHash } = await prompt.prompt({
          type: 'list',
          name: 'commitHash',
          message: 'Select commit:',
          choices: selectChoices
        });

        if (!selectedHash) {
          console.log('Cancelled.');
          continue;
        }

        commitHash = selectedHash;
        messagePreview = selectChoices.find(c => c.value === commitHash).name;
      }

      const currentHash = (await git.revparse(['HEAD'])).trim();

      // Trim stack if max size reached BEFORE pushing
      let stackTrimmed = stack;
      if (stack.length >= MAX_STACK_SIZE) stackTrimmed = stack.slice(stack.length - MAX_STACK_SIZE + 1);
      stackTrimmed.push(currentHash);
      saveStack(stackTrimmed);

      const status = await git.status();
      const hasUncommitted = status.files.length > 0;
      const resetMode = await promptResetMode(hasUncommitted);
      if (resetMode === null) continue;

      // Backup before hard reset for safety
      if (resetMode === '--hard') {
        await createBackupBranch(currentHash);
      }

      const confirmed = await confirmPrompt(`This will reset your repo to:\n${messagePreview}\nMode: ${resetMode === '--hard' ? 'HARD (danger)' : 'SAFE'}\nProceed?`);
      if (!confirmed) {
        console.log('Cancelled.');
        continue;
      }

      await git.reset([resetMode, commitHash]);
      console.log(`Reset to ${commitHash} (${resetMode === '--hard' ? 'HARD' : 'SAFE'})`);
    } catch (err) {
      console.error('Error:', err.message || err);
    }
  }
}

main();
