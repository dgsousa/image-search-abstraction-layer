const http = require("http");
const https = require("https");
const port = process.env.PORT || 3000;
const mongoose = require("mongoose");
require("dotenv").config();


mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/queries", function(err) {
	console.log("Successfully connected to the database");
})

const db = mongoose.connection;

const QuerySchema = mongoose.Schema({
	term: String,
	createdAt: { type: Date, default: Date.now}
})

const Query = mongoose.model("Query", QuerySchema);


const server = http.createServer(function(req, res) {
	searchRoute(req, res);
	historyRoute(req, res);
	endRoute(req, res);
}).listen(port);
console.log("the server is running on port ", port);


const searchRoute = (req, res) => {
	if(req.url.startsWith("/api/imagesearch/") && req.method == "GET") {
		const offset = req.url.includes("?offset=") ? getOffset(req.url) : 0;
		let results;
		const url = req.url.replace("/api/imagesearch/", "")
						 .replace("?offset=", "")
						 .replace(offset.toString(), "");
		const query = new Query({
			term: url.replace(/\%20/g, " ")
		})
		query.save();
		https.get(process.env.SEARCH_STRING + url, (response) => {
			let body = "";
			response.on("data", (chunk) => {
				body += chunk;
			})
			response.on("end", (chunk) => {
				results = JSON.parse(body).items.map((item, index) => {
					return {
						"url": item.link,
						"snippet": item.snippet,
						"thumbnail": item.thumbnailLink,
						"context": item.image.contextLink,

					}
				}).filter((item, index) => {
					if(index >= offset) return item;
				})
				res.writeHead(200, {"Content-type": "text/plain"});
				res.write(JSON.stringify(results));
				res.end();
			})
		})
	}
}



const historyRoute = (req, res) => {
	if(req.url.startsWith("/api/latest/imagesearch") && req.method == "GET") {
		const recentSearches = Query.find((err, queries) => {
			res.writeHead(200, {"Content-type": "text/plain"});
			res.write(JSON.stringify(queries.map((query, index) =>{
				return {
					term: query.term,
					createdAt: query.createdAt
				}
			})));
			res.end();
		})
	}
}

const endRoute = (req, res) => {
	if(!(req.url.startsWith("/api/imagesearch/")) && !(req.url.startsWith("/api/latest/imagesearch"))) {
		res.end();
	}
}

const getOffset = (url) => {
	const start = url.indexOf("?offset=") + "?offset=".length;
	return parseInt(url.substring(start, start + 2)) || 0;
}



process.on("SIGTERM", function() {
	db.close();
});


//