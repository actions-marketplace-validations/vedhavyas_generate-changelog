const core = require('@actions/core');
const util = require('util');
const execFile = util.promisify(require('child_process').execFile);
const {generateReleaseNotes} = require('./generate-release-notes');

async function run() {
	try {
		const releaseTemplate = core.getInput('template');
		const commitTemplate = core.getInput('commit-template');
		const exclude = core.getInput('exclude');
		const dateFormat = core.getInput('date-format');
		const reverseSort = core.getInput('reverse-sort');

		// Fetch tags from remote
		await execFile('git', ['fetch', 'origin', '+refs/tags/*:refs/tags/*']);

		// Get all tags, sorted by recently created tags
		const {stdout: t} = await execFile('git', ['tag', '-l', '--sort=-creatordate']);
		const tags = t.split('\n').filter(Boolean).map(tag => tag.trim());

		if (tags.length === 0) {
			core.info('There is nothing to be done here. Exiting!');
			return;
		}

		let pushedTag = core.getInput('tag') || tags[0];

		if (process.env.GITHUB_REF.startsWith('refs/tags/')) {
			pushedTag = process.env.GITHUB_REF.replace('refs/tags/', '');
			core.info('Using pushed tag as reference: ' + pushedTag);
		}

		// Get range to generate diff
		let range = tags[1] + '..' + pushedTag;
		if (tags.length < 2) {
			const {stdout: rootCommit} = await execFile('git', ['rev-list', '--max-parents=0', 'HEAD']);
			range = rootCommit.trim('') + '..' + pushedTag;
		}

		core.info('Computed range: ' + range);

		// Create a release with markdown content in body
		const changelog = await generateReleaseNotes({range, exclude, commitTemplate, releaseTemplate, dateFormat, reverseSort});
		core.setOutput('changelog', changelog);
		core.info('Created changelog:\n`' + changelog);
	} catch (error) {
		core.setFailed(error.message);
	}
}

run();
