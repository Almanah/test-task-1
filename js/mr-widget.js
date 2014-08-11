/*
var Post = Backbone.Model.extend({
	
});

var TwitterPost = Widget.extend({

});

var VinePost = TwitterWidget.extend({

});

var InstagramPost = Widget.extend({

});

var InstagramFotoPost = InstagramWidget.extend({

});

var InstagramVideoPost = InstagramWidget.extend({

});

var AppModel = Backbone.model.extend({

});

*/
var WidgetView = Backbone.View.extend({
	el: '#MRWidget',

	initialize: function() {

	}
});


var url = 'http://api.massrelevance.com/jmskey/ema-instagram.json';
var posts = null;

var xhr = new XMLHttpRequest();
xhr.onload = function() {
	posts = parseResponse(this.responseText);
	var template = _.template($('#MRWidgetTemplate').html());

	//debugger;
	$('#MRWidget').html(template(posts[1]));
	//setTimeout(function() {$('#MRWidget').html(template(posts[1]));}, 5000);

};	
xhr.open('GET', url, true);
xhr.send();

var parseResponse = function(rawJSON) {
	var rawPosts = JSON.parse(rawJSON);
	var posts = [];

	console.log(rawPosts);

	rawPosts.forEach(function(element) {
		var newPost = {},
			date = null;
		newPost.counts = {};

		if(element.network === 'twitter') {
			var numOfUrls = element.entities.urls.length,
				expandedURL = numOfUrls > 0 ? element.entities.urls[numOfUrls - 1].expanded_url : '';

			if(expandedURL.indexOf('vine.co/v/') !== -1) {
				newPost.type = 'vine';
				//expandedURL = expandedURL.replace(':', '%3A');
				
				var request = new XMLHttpRequest();
				var url = 'http://api.embed.ly/1/oembed?url=' + expandedURL + '&width=260';
				/*
				request.onload = (function() {
					var post = newPost;
					return function() {
						post.content = JSON.parse(this.responseText).html || '';
						//console.log(post.content);
					}
				})();
				*/
				request.open('GET', url, false);
				request.send();				
				newPost.content = JSON.parse(request.responseText).html;
				//console.log(newPost.content, 'Azaza');
			} else {
				newPost.type = 'tweet';				
				newPost.content = element.text;				
			}
			date = new Date(element.created_at);
			if(date.getDay() === (new Date(Date.now())).getDay()) {
				newPost.time === date.getHours();
			} else {
				newPost.time = element.created_at;				
			}

			newPost.userName = element.user.screen_name;
			newPost.userImage = element.user.profile_image_url;
			newPost.userUrl = 'http://twitter.com/' + newPost.userName;
			newPost.postUrl = 'http://twitter.com/' + newPost.userName + '/status/' + element.id_str;
			newPost.counts.favoriteNum = element.favorite_count;
			newPost.counts.retweetNum = element.retweet_count;		
		} else if(element.network === 'instagram') {
			newPost.type = element.type;

			date = new Date(element.created_time * 1000);
			newPost.time = element.created_time;
			newPost.userName = element.user.username;
			newPost.userImage = element.user.profile_picture;
			newPost.userUrl = 'http://instagram.com/' + newPost.userName;
			newPost.postUrl = element.link;
			newPost.counts.likesNum = element.likes.count;
			newPost.counts.commentsNum = element.comments.count;

			if(newPost.type === 'image') {
				newPost.content = '<a href = "' + newPost.postUrl + '" target = "_blank"><img src = "' + element.images.standard_resolution.url + '"></a>';
			} else {
				var request = new XMLHttpRequest(),
					videoUrl = element.link;
				
				//videoUrl = videoUrl.replace(':', '%3A');
				//console.log(videoUrl);
				var url = 'http://api.embed.ly/1/oembed?url=' + videoUrl + '&height=220';
				request.open('GET', url, false);
				request.send();

				newPost.content = JSON.parse(request.responseText).html;
				console.log(request.responseText);
			}
		} else {
			console.log('Error');
		}
		//console.log(newPost.type);
		posts.push(newPost);
	});
	return posts;
}

