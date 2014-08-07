var Widget = Backbone.model.extend({
	
});

var TwitterWidget = Widget.extend({

});

var VineWidget = TwitterWidget.extend({

});

var InstagramWidget = Widget.extend({

});

var InstagramFotoWidget = InstagramWidget.extend({

});

var InstagramVideoWidget = InstagramWidget.extend({

});

var AppModel = Backbone.model.extend({

});

var url = 'https://api.massrelevance.com/jmskey/ema-instagram.json';

var xhr = new XMLHttpRequest();
xhr.onload = function() {
	parseResponse(this.responseText);
};	
xhr.open('GET', url, true);
xhr.send();

var parseResponse = function(rawJSON) {
	var rawPosts = JSON.parse(rawJSON);
	var posts = [];

	rawPosts.forEach(function(element) {
		var newPost = {};

		if(element.network === 'twitter') {
			var numOfUrls = element.entities.urls.length,
				expandedURL = numOfUrls > 0 ? element.entities.urls[numOfUrls - 1].expanded_url : '';

			if(expandedURL.indexOf('vine.co/v/') !== -1) {
				newPost.type = 'vine';
			} else {
				newPost.type = 'tweet';
				newPost.time = element.created_at;
				newPost.userName = element.user.screen_name;
				newPost.userImage = element.user.profile_image_url;
				newPost.userUrl = 'http://twitter.com/' + newPost.userName;
				newPost.postUrl = 'http://twitter.com/' + newPost.userName + '/status/' + element.id_str;
				newPost.content = element.text;
				newPost.favoriteNum = element.favorite_count;
				newPost.retweetNum = element.retweet_count;
			}				
		} else if(element.network === 'instagram') {
			newPost.type = element.type;
			newPost.time = element.created_time;
			newPost.userName = element.user.username;
			newPost.userImage = element.user.profile_picture;
			newPost.userUrl = 'http://instagram.com' + newPost.userName;
			newPost.postUrl = element.link;
			newPost.likesNum = element.likes.count;
			newPost.commentsNum = element.comments.count;

			if(newPost.type === 'image') {
				newPost.content = element.images.standart_resolution.url;
			} else {
				newPost.content = element.videos.standart_resolution.url;
			}
		} else {
			console.log('Error');
		}
		console.log(newPost.type);
		posts.push(newPost);
	});
	console.log(posts);

}