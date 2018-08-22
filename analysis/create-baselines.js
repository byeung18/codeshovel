var fs = require('fs');
var path = require('path');


var srcDir = process.env.SRC_DIR;
var dstDir = process.env.DST_DIR;
var repo = "all";//process.env.REPO_NAME;  // set to null to run against all repos

console.log("ENV: " + JSON.stringify(process.env));

if (repo === "all") {
	fs.readdir(srcDir + "/codeshovel", function(err, list) {
		list.forEach(function(item) {
			execute(item);
		});
	});
} else {
	execute(repo);
}

function execute(repo) {

	console.log("execute(): " + repo);

	var dirCodeshovel = srcDir + "/codeshovel/" + repo;
	var dirDiff = srcDir + "/diff_semantic_gitlog/" + repo;

	function median(values) {
		values.sort(function(a, b) {
			return a - b;
		});
		var lowMiddle = Math.floor((values.length - 1) / 2);
		var highMiddle = Math.ceil((values.length - 1) / 2);
		var median = (values[lowMiddle] + values[highMiddle]) / 2;
		return median;
	}

	/**
	 * Explores recursively a directory and returns all the filepaths and folderpaths in the callback.
	 *
	 * @see http://stackoverflow.com/a/5827895/4241030
	 * @param {String} dir
	 * @param {Function} done
	 */
	function filewalker(dir, done) {
		var results = [];

		fs.readdir(dir, function(err, list) {
			if (err) return done(err);

			var pending = list.length;

			if (!pending) return done(null, results);

			list.forEach(function(file){
				file = path.resolve(dir, file);

				fs.stat(file, function(err, stat){
					// If directory, execute a recursive call
					if (stat && stat.isDirectory()) {
						// Add directory to array [comment if you need to remove the directories from the array]
						// results.push(file);

						filewalker(file, function(err, res){
							results = results.concat(res);
							if (!--pending) done(null, results);
						});
					} else {
						results.push(file);

						if (!--pending) done(null, results);
					}
				});
			});
		});
	};

	var fullResult = { repo: repo };

	filewalker(dirDiff, function(error, results) {
		if (error) {
			console.log(error);
			throw error;
		}

		// do something with files
		// how many "extra" commits did we find?
		var totalShovel = 0;
		var totalBase = 0;
		var totalOnlyShovel = 0;
		var totalOnlyBase = 0;
		var methodDetails = {};
		var shovelResultsArr = [];
		var baseResultsArr = [];

		fullResult.totalMethods = results.length;
		fullResult.totalHistoryEquals1 = 0;
		fullResult.totalHistory2To5 = 0;
		fullResult.totalHistory6To10 = 0;
		fullResult.totalHistoryGt10 = 0;
		fullResult.totalHistoryCount = {};

		console.log("Iterating semantic diff files for repo: " + repo);

		results.forEach(function(file) {
			try {
				var diffObj = JSON.parse(fs.readFileSync(file));
				var methodId = file.split("/diff_semantic_gitlog/")[1].replace(".json", "");
				var singleMethodResult = {};

				var numShovel = diffObj.codeshovelHistory.length;
				shovelResultsArr.push(numShovel);
				totalShovel += numShovel;
				singleMethodResult.sizeShovel = numShovel;
				if (numShovel === 1) {
					fullResult.totalHistoryEquals1 += 1;
				}
				else if (numShovel <= 5) fullResult.totalHistory2To5 += 1;
				else if (numShovel <= 10) fullResult.totalHistory6To10 += 1;
				else if (numShovel > 10) fullResult.totalHistoryGt10 += 1;

				if (!fullResult.totalHistoryCount[numShovel]) {
					fullResult.totalHistoryCount[numShovel] = 1;
				} else {
					fullResult.totalHistoryCount[numShovel] += 1;
				}

				var numBase = diffObj.baselineHistory.length;
				totalBase += numBase;
				singleMethodResult.sizeBase = numBase;
				baseResultsArr.push(numBase);

				var numOnlyShovel = diffObj.onlyInCodeshovel.length;
				totalOnlyShovel += numOnlyShovel;
				singleMethodResult.sizeOnlyShovel = numOnlyShovel;

				var numOnlyBase = diffObj.onlyInBaseline.length;
				totalOnlyBase += numBase;
				singleMethodResult.sizeOnlyBase = numOnlyBase;

				methodDetails[methodId] = singleMethodResult;


			} catch (err) {
				console.log("ERROR processing file: " + file + " -- " + err);
			}
		});

		fullResult.avgSizeShovel = totalShovel / fullResult.totalMethods;
		fullResult.avgSizeBase = totalBase / fullResult.totalMethods;
		fullResult.medianSizeShovel = median(shovelResultsArr);
		fullResult.medianSizeBase = median(baseResultsArr);
		// fullResult.methodDetails = methodDetails;

		try {
			collectShovel();
		} catch (err) {
			console.err("Could not collect shovel stats");
		}

	});

	function addStats(statsObj, changeType) {
		var doAdd = function(changeType) {
			if (!statsObj[changeType]) {
				statsObj[changeType] = 1;
			} else {
				statsObj[changeType] += 1;
			}
		};

		if (changeType.startsWith("Ymultichange")) {
			var subchangesString = changeType.split("Ymultichange(")[1].replace(")", "");
			var subchangesArr = subchangesString.split(",");
			subchangesArr.forEach(function(subchange) {
				doAdd(subchange);
			});
		} else {
			doAdd(changeType);
		}

	}

	function collectShovel() {
		filewalker(dirCodeshovel, function(error, results) {
			if (error) {
				console.log(error);
				throw error;
			}

			// do something with files
			// how many "extra" commits did we find?
			var changeStats = {};
			var methodSizeStats = {};
			var statsMethodsOneChange = {
				setters: 0,
				getters: 0,
				tests: 0
			};
			var countSmallMethodsForOneChange = 0;
			var countSmallMethodsForMoreThanOneChange = 0;

			var sumLineLengthOneChange = 0;
			var sumLineLengthMoreThanOneChange = 0;
			var totalHistoryTime = 0;

			console.log("Iterating codeshovel results for repo: " + repo);

			results.forEach(function(file) {
				try {
					var shovelObj = JSON.parse(fs.readFileSync(file));
					var methodId = file.split(srcDir + "/codeshovel/")[1].replace(".json", "");
					var methodName = shovelObj.functionName;

					var numChanges = Object.keys(shovelObj.changeHistoryShort).length;
					if (!methodSizeStats[numChanges]) {
						methodSizeStats[numChanges] = {};
					}

					var numMethodLines = 1 + (shovelObj.functionEndLine - shovelObj.functionStartLine);
					if (!methodSizeStats[numChanges][numMethodLines]) {
						methodSizeStats[numChanges][numMethodLines] = 1;
					} else {
						methodSizeStats[numChanges][numMethodLines] += 1;
					}

					if (numMethodLines <= 3) {
						if (numChanges <= 1) {
							countSmallMethodsForOneChange += 1;
						} else {
							countSmallMethodsForMoreThanOneChange += 1;
						}
					}

					if (numChanges === 1) {
						sumLineLengthOneChange += numMethodLines;
						if (numMethodLines <= 3) {
							if (methodName.startsWith("get") || methodName.startsWith("is")) {
								statsMethodsOneChange.getters += 1;
							} else if (methodName.startsWith("set")) {
								statsMethodsOneChange.setters += 1;
							}
						}
						if (methodName.startsWith("test")) {
							statsMethodsOneChange.tests += 1;
						}
					} else {
						sumLineLengthMoreThanOneChange += numMethodLines;
					}

					for (var commitName in shovelObj.changeHistoryShort) {
						var changeType = shovelObj.changeHistoryShort[commitName];
						addStats(changeStats, changeType);
					}
				} catch (err) {
					console.log("ERROR processing file: " + file + "  --  " + err);
				}
			});

			fullResult.changeStats = changeStats;
			fullResult.countSmallMethodsForOneChange = countSmallMethodsForOneChange;
			fullResult.countSmallMethodsForMoreThanOneChange = countSmallMethodsForMoreThanOneChange;

			var numMethodsOneChange = fullResult.totalHistoryCount["1"];
			var numMethodsMoreThanOneChange = fullResult.totalMethods - numMethodsOneChange;
			fullResult.avgMethodSizeOneChange = sumLineLengthOneChange / numMethodsOneChange;
			fullResult.avgMethodsMoreThanOneChange = sumLineLengthMoreThanOneChange / numMethodsMoreThanOneChange;

			fullResult.statsMethodsOneChange = statsMethodsOneChange;
			fullResult.methodSizeStatsLeftNumChangesRightNumLinesNumMethods = methodSizeStats;

			var jsonResult = JSON.stringify(fullResult, null, 2);
			var filePath = dstDir + "/stats-" + repo + ".json";
			fs.writeFile(filePath, jsonResult, function(err) {
				if (err) {
					console.log(err);
				}

				console.log("Result for repo " + repo + " saved: " + filePath);
			});
		});
	}
}



// {
//     "origin": "codeshovel",
//     "repositoryName": "guava",
//     "repositoryPath": "/home/ncbradley/codeshovel-repos/guava/.git",
//     "startCommitName": "34c1616279efe08089960aafd3df486cf8a04820",
//     "sourceFileName": "Absent.java",
//     "functionName": "get",
//     "functionId": "get",
//     "sourceFilePath": "android/guava/src/com/google/common/base/Absent.java",
//     "functionStartLine": 42,
//     "functionEndLine": 44,
//     "changeHistory": [
//       "9b94fb3965c6869b0ac47420958a4bbae0b2d54c"
//     ],
//     "changeHistoryShort": {
//       "9b94fb3965c6869b0ac47420958a4bbae0b2d54c": "Yintroduced"
//     },
//     "changeHistoryDetails": {
//       "9b94fb3965c6869b0ac47420958a4bbae0b2d54c": {
//         "type": "Yintroduced",
//         "commitMessage": "Begin exporting sources of Guava for Android.\n\npom.xml files to come.\n\n-------------\nCreated by MOE: https://github.com/google/moe\nMOE_MIGRATED_REVID\u003d153757913\n",
//         "commitDate": 1492741671000,
//         "commitName": "9b94fb3965c6869b0ac47420958a4bbae0b2d54c",
//         "commitAuthor": "zhenghua"
//       }
//     }
//   }
