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
  if (!confirm) {
    console.log('Cancelled.');
    process.exit(0);
  }
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
      console.log('Cancelled.');
      process.exit(0);
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

async function createBackupBranch(currentHash) {
  const backupBranch = `vergit-backup-${Date.now()}`;
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
  try {
    console.log('vergit — Interactive Git version navigator\n');

    let stack = loadStack();

    const choices = [
      { name: 'Undo: Previous commit', value: 'undo' },
      { name: 'Select a commit', value: 'select' }
    ];
    choices.push({ name: 'Redo: Latest remote commit (git pull)', value: 'redo' });

    const { action } = await prompt.prompt({
      type: 'list',
      name: 'action',
      message: 'Choose an action:',
      choices
    });

    if (action === 'redo') {
      console.log('Pulling from remote...');
      await git.pull();
      console.log('Up to date.');
      return;
    }

    let commitHash, messagePreview;

    if (action === 'undo') {
      const log = await git.log({ maxCount: 2 });
      if (log.all.length < 2) {
        console.log('No previous commit.');
        process.exit(0);
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
        process.exit(0);
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

    // Backup before hard reset for safety
    if (resetMode === '--hard') {
      await createBackupBranch(currentHash);
    }

    await confirmPrompt(`This will reset your repo to:\n${messagePreview}\nMode: ${resetMode === '--hard' ? 'HARD (danger)' : 'SAFE'}\nProceed?`);

    await git.reset([resetMode, commitHash]);
    console.log(`Reset to ${commitHash} (${resetMode === '--hard' ? 'HARD' : 'SAFE'})`);
  } catch (err) {
    console.error('Error:', err.message || err);
  }
}

main();
