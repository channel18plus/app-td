(function($hn) {
	var perfData = {
		insertedNodeCount: 0
	},
	update = function(id, type, time) {
		if (!perfData[id]) {
			perfData[id] = {};
		}
		if (arguments.length === 2) {
			perfData[id] = arguments[1];
		}
		else {
			perfData[id][type] = (perfData[id][type] ? perfData[id][type] + ',' : '') + time;
		}
	};

	$hn.perf = {
		update: update,
		data: perfData
	};

	//document.body.addEventListener('DOMNodeInserted', updateNodeCount, false);
}(window.$hn));
(function($hn) {
	var localData;
	var resetCache = function() {
		console.log("resetCache");
		localData = {
			articles: {}
		};
	};
	resetCache();

	var primaryServer = $hn.url.rootPath,
			backupServer = $hn.url.storiesBackup;
	var server = primaryServer;

	var getUrl = function(type) {
		var configPath = $hn.url.configPath;
		if (typeof $hn.url.config === 'undefined') {
			var onSuccess = function(data) {
				$hn.url.config = data;
			};
			$hn.ajax({
				url: server + configPath,
				dataType: 'json',
				success: onSuccess
			});
			console.log('Get url of type: ' + type + " result: " + server + configPath + " current $hn.url.config");
			console.log($hn.url.config);
			return server + configPath;
		}
		else {
			console.log('Get url of type: ' + type);
			console.log(" result: " + server + $hn.url.config[type].path + " current $hn.url.config");
			console.log($hn.url.config);
			return server + $hn.url.config[type].path;
		}
	};

	var lastServerChangeTime;
	var changeServer = function(url) {
		console.log('change server', lastServerChangeTime, server);
		if (!lastServerChangeTime || lastServerChangeTime + (1000 * 60 * 20) < +new Date()) {
			lastServerChangeTime = +new Date();
			server = (server === primaryServer ? backupServer : primaryServer);
			console.log(lastServerChangeTime, server);
			return true;
		}
		return false;
	};


	var updateLocalData = function() {
		$.each(localData.list, function(index, item) {
			item.visitedComments = '';
			item.visitedArticle = '';
			if (visitedData[item.id]) {
				if (visitedData[item.id].a) {
					item.visitedArticle = 'visited';
				}
				if (visitedData[item.id].c) {
					item.visitedComments = 'visited';
				}
			}
			if (item.type === 'job') {
				item.points = 'JOB';
			}
			if (!item.user) {
				item.user = '';
			}
			item.title = item.title.replace('<', '&lt;');
			localData.articles[item.id] = item;
		});
	};
	var visitedData = {
//        id : {
//            'c' : +new Date(),
//            'a' : +new Date(),
//        },
//        version: 2
	};

	var readLocalData = function() {
		console.log('readLocalData()');
		var t0ls = +new Date(),
				localVisitedData = window.store.get('visited'),
				localStorageList = window.store.get('list');

		$hn.perf.update('localstorage', 'read', +new Date() - t0ls);

		if (localVisitedData) {
			$.extend(true, visitedData, localVisitedData);

			if (!visitedData.version) {
				$.each(visitedData, function(i, item) {
					if (item.a) {
						item.a = item.d;
					}
					if (item.c) {
						item.c = item.d;
					}
					delete item.d;
				});
			}
			visitedData.version = 2;

			$.each(visitedData, function(index, item) {
				if (index !== 'version') {
					if (item.a < +new Date() - (1000 * 60 * 60 * 24 * 7)) {
						delete item.a;
					}
					if (item.c < +new Date() - (1000 * 60 * 60 * 24 * 7)) {
						delete item.c;
					}
					if (!item.a && !item.c) {
						delete visitedData[index];
					}
				}
			});

			saveVisitedData();
		}
		if (localStorageList) {
			if (+new Date() - localStorageList.timestamp < 1000 * 60 * 5) {
				localData.list = localStorageList.data;
				updateLocalData();
			}
		}
	};

	var saveVisitedId = null;
	var saveVisitedDelayed = function() {
		console.log('saveVisitedDelayed()');
		saveVisitedId = null;
		window.store.set('visited', visitedData);
	};
	var saveVisitedData = function() {
		console.log('saveVisitedData()');
		if (saveVisitedId) {
			window.clearTimeout(saveVisitedId);
			saveVisitedId = null;
		}

		saveVisitedId = window.setTimeout(saveVisitedDelayed, 1000);
	};

	var addVisited = function(id, type) {
		if (!visitedData[id]) {
			visitedData[id] = {};
		}
		visitedData[id][type] = +new Date();

		saveVisitedData();
	};
//    window.setTimeout(readLocalData, 1);
	readLocalData();

	var getLocalData = function() {
		return localData;
	};
	var updateList = function(callback) {
		callback = callback || function() {
		};
		var onSuccess = function(data) {
			resetCache();
			$hn.perf.update('list', 'fetch', +new Date() - t0Ajax);
			localData.list = data;
			updateLocalData();
			callback.apply(callback, [localData.list]);
			window.store.set('list', {data: localData.list, timestamp: +new Date()});
		},
				t0Ajax = +new Date();
		$hn.ajax({
			url: getUrl('home'),
			dataType: 'json',
			success: onSuccess,
			error: function(xhr, status)
			{
				if ("ajaxError|abort".indexOf(status) > -1 && changeServer()) {
					updateList(callback);
				}
			}
		});
	};
	var callbackLoop = 0;
	var updateArticleContent = function(id, callback) {
		callback = callback || function() {
		};
		console.log('call success' + localData.config);
		if (!localData.articles[id] && callbackLoop++ < 3) {
//            alert('updateArticleContent(): Something went wrong! Reload??? ' + id);
			window.setTimeout(function() {
				updateArticleContent(id, callback);
			}, 400);
		}

		var fallbackContent = function() {
			return $hn.t('<p>Oops... Something went terribly wrong... </p><p>Follow this link <a href="{url}">{url}</a> to view the article</p><br><br>', {url: localData.articles[id].url});
		},
				onSuccess = function(data) {
					$hn.perf.update(id, 'article-fetch', +new Date() - t0Ajax);
					var a = $('<div></div>').html(data.content || fallbackContent());
					$('*', a).each(function(index, node) {
						if (node.className) {
							node.className = '';
						}
					});
					localData.articles[id].article = a.html();
					callback.apply(callback, [localData.articles[id]]);
				},
				onError = function(data) {
					localData.articles[id].articlecontent = fallbackContent();
					callback.apply(callback, [localData.articles[id]]);
				},
				t0Ajax = +new Date();

		$hn.ajax({
			url: server + $hn.url.config[localData.articles[id].type].contentPath + id,
			dataType: 'json',
			success: onSuccess,
			error: onError
		});
	};

	var updateArticleComments = function(id, callback) {

		callback = callback || function() {
		};

		var getLastCommentId = function(comments) {
			var lastCommentId;
			$.each(comments, function(index, item) {
				var tempId;
				if (!lastCommentId || item.id > lastCommentId) {
					lastCommentId = item.id;
				}

				tempId = getLastCommentId(item.comments);
				if (item.comments && tempId && tempId > lastCommentId) {
					lastCommentId = tempId;
				}
			});
			return lastCommentId;
		};

		var onSuccess = function(data) {
			$hn.perf.update(id, 'comments-fetch', +new Date() - t0Ajax);
			var article = localData.articles[id];
			//if (!article) {
			article = localData.articles[id] = data;
			//}
			//else {
			//    article.comments = data.comments;
			//}

			if (article.url.indexOf('item') === 0) {
				delete article.url;
			}

			if (visitedData[id] && visitedData[id].lastReadComment) {
				article.lastReadComment = visitedData[id].lastReadComment;
			}

			article.commentsFetchTime = +new Date();
			callback.apply(callback, [article]);

			window.setTimeout(function() {
				visitedData[id].lastReadComment = getLastCommentId(article.comments);
				saveVisitedData();
			}, 300);
		},
				t0Ajax = +new Date();
		$hn.ajax({
			url: $hn.t(getUrl('item'), {id: id}),
			dataType: 'jsonp',
			success: onSuccess,
			error: function(xhr, status) {
				console.log('ajax primary server failed, try backup server: ', status, xhr);
				if ('error|abort'.indexOf(status) > -1 && changeServer()) {
//					updateArticleComments(id, callback);
				}
			}
		});
	};

	var getArticles = function(callback, reload) {
		reload = reload || false;
		callback = callback || function() {
		};

		if (!reload && localData.list) {
			return callback.apply(callback, [localData.list]);
		}

		updateList(callback);
	};



	var getArticleMeta = function(id, callback) {
		callback = callback || function() {
		};

		var article = localData.articles[id];
		if (article) {
			return callback.apply(callback, [article]);
		}

		var onSuccess = function(data) {
			$hn.perf.update(id, 'comments-fetch', +new Date() - t0Ajax);
			data.commentsFetchTime = +new Date();
			if (data.url.indexOf('item') === 0) {
				delete data.url;
			}
			localData.articles[id] = data;
			callback.apply(callback, [data]);
		},
				t0Ajax = +new Date();

		$hn.ajax({
			url: getUrl('item') + id + '.json',
			dataType: 'jsonp',
			success: onSuccess,
			error: function(xhr, status) {
				console.log('ajax primary server failed, try backup server: ', status, xhr);
				if ('error|abort'.indexOf(status) > -1 && changeServer()) {
					getArticleMeta(id, callback);
				}
			}
		});
	};

	var getArticleContent = function(id, callback, reload) {
		reload = reload || false;
		callback = callback || function() {
		};

		addVisited(id, 'a');
		var article = localData.articles[id];
		if (!reload && article && article.content) {
			return callback.apply(callback, [article]);
		}

		updateArticleContent(id, callback);
	};

	var getArticleComments = function(id, callback, reload) {
		reload = reload || false;
		callback = callback || function() {
		};

		addVisited(id, 'c');
		var article = localData.articles[id];
		if (!reload && article && article.comments && article.commentsFetchTime < (+new Date() + (1000 * 60 * 5))) {
			return callback.apply(callback, [article]);
		}

//		updateArticleComments(id, callback);
	};

	var reformatData = function(type,data) {
		var t0Reformat = +new Date(),
				tempData = [];
		if (typeof data === undefined)
			return null;
		$.each(data, function(index, item) {
			console.log(item);
			var tempItem = {
				id: item.id,
				comments_count: item.num_comments,
				domain: item.domain,
				points: item.points,
				time_ago: $hn.timeAgo(+new Date(item.create_ts)),
				title: item.title,
				content: item.text || '',
				type: type,
				url: item.url,
				user: item.username,
				visitedArticle: '',
				visitedComments: ''
			};
			if (visitedData[item.id]) {
				if (visitedData[item.id].c) {
					tempItem.visitedComments = 'visited';
				}
				if (visitedData[item.id].a) {
					tempItem.visitedArticle = 'visited';
				}
			}
			localData.articles[item.id] = tempItem;
			tempData.push(tempItem);
		});

		$hn.perf.update('list'+type, 'reformat', +new Date() - t0Reformat);
		return tempData;
	};

	var updateArticlesByType = function(type, callback) {
		callback = callback || function() {
		};
		var onSuccess = function(data) {
			$hn.perf.update('list' + type, 'fetch', +new Date() - t0Ajax);
			console.log(data);
			localData['list' + type] = reformatData(type,data);
			callback.apply(callback, [data]);
		},
				t0Ajax = +new Date();

		$hn.ajax({
			url: getUrl(type),
			dataType: 'json',
			success: onSuccess
		});
	};

	var getArticlesByType = function(type, callback, reload) {
		reload = reload || false;
		callback = callback || function() {
		};
		//lay path truyen sang updateArticlesByType
		if (!reload && localData['list' + type]) {
			return callback.apply(callback, [localData['list' + type]]);
		}

		updateArticlesByType(type, callback);
	};
// LAY DANH SACH CATEGORY
	var getCategories = function(callback) {
		callback = callback || function() {
		};
		if (typeof $hn.url.config === 'undefined') {
			var onSuccess = function(data) {
				$hn.url.config = data;
				callback.apply(callback, [$hn.url.config]);
				console.log('Call get categories success');
				console.log($hn.url.config);
			};
			$hn.ajax({
				url: server + $hn.url.configPath,
				dataType: 'json',
				success: onSuccess
			});
		} else {
			callback.apply(callback, [$hn.url.config]);
		}
	};

// KET THUC LAY CATEGORY
	$hn.data = {
		getCategories: getCategories,
		getArticles: getArticles,
		getArticleMeta: getArticleMeta,
		getArticleContent: getArticleContent,
		getArticleComments: getArticleComments,
		getArticlesByType: getArticlesByType,
		cache: getLocalData
	};
}(window.$hn));