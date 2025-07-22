#!/usr/bin/env node

const inquirer = require('inquirer');
const simpleGit = require('simple-git');

const git = simpleGit();

async function main() {
  try {
    // Ask user what to do
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What do you want to do?',
        choices: [
          { name: 'Undo: Go back to the previous commit (one step back)', value: 'undo' },
          { name: 'Select from a list of previous commits', value: 'select' }
        ]
      }
    ]);

    let commitHash, messagePreview;

    if (action === 'undo') {
      // Get the previous commit
      const log = await git.log({ maxCount: 2 });
      if (log.all.length < 2) {
        console.log('No previous commit to revert to.');
        process.exit(0);
      }
      commitHash = log.all[1].hash;
      messagePreview = `${log.all[1].hash.slice(0, 7)} | ${log.all[1].date.slice(0, 10)} | ${log.all[1].message}`;
      console.log(`Previous commit: ${messagePreview}`);
    } else {
      // Select from recent commits
      const log = await git.log({ maxCount: 15 });
      const choices = log.all.map(commit => ({
        name: `${commit.hash.slice(0, 7)} | ${commit.date.slice(0, 10)} | ${commit.message}`,
        value: commit.hash
      }));

      const result = await inquirer.prompt([
        {
          type: 'list',
          name: 'commitHash',
          message: 'Select a commit to reset to:',
          choices
        }
      ]);
      commitHash = result.commitHash;
      messagePreview = choices.find(c => c.value === commitHash).name;
    }

    // Confirm reset
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `This will reset your repo to commit:\n${messagePreview}\nProceed?`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log('Aborted.');
      process.exit(0);
    }

    // Reset repo
    await git.reset(['--hard', commitHash]);
    console.log(`Repository reset to ${commitHash}`);
  } catch (err) {
    console.error('Error:', err.message || err);
  }
}

main();
