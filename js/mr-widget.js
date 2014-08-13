(function() {

	//	Set your parametres here
	var URL = 'http://api.massrelevance.com/jmskey/vine-test.json',	// Url of your stream
		REFRESH_INTERVAL = 5000;	// Refresh time in milliseconds

	//Backbone logic
	var Post = Backbone.Model.extend({
		initialize: function() {
			this.set('content', '');
			this.set('counts', {});
		}
	});

	var PostsQueue = Backbone.Collection.extend({});

	var WidgetView = Backbone.View.extend({
		el: '#MRWidget',
		template: _.template($('#MRWidgetTemplate').html()),

		initialize: function() {		
			this.currentPost = 0;
			this.postsCount = this.collection.length;
			//	Need to rerender view if content of current post updates
			this.collection.on('change:content', (function(view) {
				return function(e) {
					if(e.cid === 'c' + view.currentPost) {
						view.render(view.currentPost, false);
					}
				}
			})(this));
			this.startRefreshing();
		},

		startRefreshing: function() {
			this.currentPost++;
			this.render(this.currentPost, true);			
			if(this.currentPost === this.postsCount)
				return;
			setTimeout(this.startRefreshing.bind(this), REFRESH_INTERVAL);
		},

		render: function(postID, isAnimated) {
			//	Set animation for all posts except first or in case of updated content
			if(postID !== 1 && isAnimated) {
				this.$el.fadeOut('400', (function(view) {
					return function() {
						view.$el.html(view.template(view.collection.get('c' + postID).toJSON()));
						view.$el.fadeIn('400');
					}
				})(this));
			} else {
				this.$el.html(this.template(this.collection.get('c' + postID).toJSON()));
			}
			return this;
		}
	});

	//
	var parseResponse = function(rawJSON) {
		var rawPosts = JSON.parse(rawJSON),
			posts = [];

		rawPosts.forEach(function(element) {
			if(element.network === 'twitter') {
				posts.push(createTwitterModel(element));
			} else if(element.network === 'instagram') {
				posts.push(createInstagramModel(element));
			} else {
				console.log('Error');
			}
		});
		return posts;
	};

	var createTwitterModel = function(element) {
		var newPost = new Post(),
			numOfUrls = element.entities.urls.length,
			expandedURL = numOfUrls > 0 ? element.entities.urls[numOfUrls - 1].expanded_url : '';

		newPost.set({
			userName: element.user.screen_name,
			userImage: element.user.profile_image_url,
			userUrl: 'http://twitter.com/' + newPost.get('userName'),
			postUrl: 'http://twitter.com/' + newPost.get('userName') + '/status/' + element.id_str,
			time: element.created_at,
			counts: {
				favorites: {
					value: element.favorite_count,
					imageSrc: ''
				},
				retweets: {
					value: element.retweet_count,
					imageSrc: ''
				}
			}
		});

		//Check vine or not
		if(expandedURL.indexOf('vine.co/v/') !== -1) {				
			var url = 'http://api.embed.ly/1/oembed?url=' + expandedURL + '&height=220';
			getEmbedVideo(newPost, url);
			newPost.set('type', 'vine');
		} else {
			newPost.set({
				type: 'tweet',
				content: element.text
			});				
		}
		return newPost;
	};

	var createInstagramModel = function(element) {
		var newPost = new Post();

		newPost.set({
			type: element.type,
			time: element.created_time * 1000,
			userName: element.user.username,
			userImage: element.user.profile_picture,
			userUrl: 'http://instagram.com/' + newPost.get('userName'),
			postUrl: element.link,
			counts: {
				likes: {
					value: element.likes.count,
					imageSrc: ''
				},
				comments: {
					value: element.comments.count,
					imageSrc: ''
				}
			}
		});
		//	Check type of post
		if(newPost.get('type') === 'image') {
			newPost.set('content', '<a href = "' + newPost.get('postUrl') + '" target = "_blank"><img src = "' + element.images.standard_resolution.url + '"></a>');
		} else {
			var videoUrl = element.link,
				url = 'http://api.embed.ly/1/oembed?url=' + videoUrl + '&height=220';
			getEmbedVideo(newPost, url);
		}
		return newPost;
	};

	var getEmbedVideo = function(model, url) {
		var request = new XMLHttpRequest();

		request.onload = (function() {
			var post = model;
			return function() {
				if(this.status === 200)
					post.set('content', JSON.parse(this.responseText).html);
				else
					post.set('content', 'Sorry, some kind of error has occurred<br>' + this.status + ' ' + this.statusText);
			}
		})();
		request.open('GET', url, true);
		request.send();
	};

	//	Widget start point 
	var createQueue = (function () {
		var xhr = new XMLHttpRequest();
			xhr.onload = function() {
				var	postsQueue = new PostsQueue(parseResponse(this.responseText)),
					appView = new WidgetView({collection: postsQueue});
			};
		xhr.open('GET', URL, true);
		xhr.send();
	})();
})();