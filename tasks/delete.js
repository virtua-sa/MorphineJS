"use strict";

var fs = require("fs-extra");

module.exports = cb => {
	console.warn("Task : 'delete'...".green);
	let toDelete = ["assets/compiled"];
	if (fs.existsSync(morphineserver.rootDir + "/.tmp/.morphinejs.conf.json")) fs.unlinkSync(morphineserver.rootDir + "/.tmp/.morphinejs.conf.json");
	async.eachSeries(
		toDelete,
		(dir, nextDir) => {
			fs.emptydir(dir, err => {
				nextDir();
			});
		},
		() => {
			console.warn("ok");
			cb();
		}
	);
	// cb() ;
};
