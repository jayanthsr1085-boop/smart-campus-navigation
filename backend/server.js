const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGO_URI = "mongodb+srv://jayanthsr1085_db_user:JTjgdYb9vObt8oDh@cluster0.0twcdpu.mongodb.net/smart_campus";
const DATABASE_NAME = "smart_campus";

const client = new MongoClient(MONGO_URI);
let db;

// Connect to MongoDB in the background so the app never exits early
client.connect().then(() => {
    db = client.db(DATABASE_NAME);
    console.log("MongoDB connected successfully!");
}).catch(error => {
    console.error("MongoDB connection failed:", error.message);
});

// Home route
app.get("/", (req, res) => {
    res.send("Smart Campus Navigation Backend is Running!");
});

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "Backend is working properly"
    });
});

// Get timetable
app.get("/api/timetable", (req, res) => {
    try {
        const timetablePath = path.join(__dirname, "data", "timetable.json");
        const timetableData = JSON.parse(fs.readFileSync(timetablePath, "utf8"));
        res.json({
            status: "success",
            data: timetableData
        });
    } catch (error) {
        console.error("Timetable error:", error.message);
        res.status(500).json({
            status: "error",
            message: "Unable to load timetable"
        });
    }
});

// Get campus graph for A* routing
app.get("/api/graph", (req, res) => {
    try {
        const graphPath = path.join(__dirname, "data", "campus-graph.json");
        const graphData = JSON.parse(fs.readFileSync(graphPath, "utf8"));
        res.json({
            status: "success",
            data: graphData
        });
    } catch (error) {
        console.error("Graph error:", error.message);
        res.status(500).json({
            status: "error",
            message: "Unable to load campus graph"
        });
    }
});

// Get campus locations from MongoDB
app.get("/api/locations", async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ status: "error", message: "Database connecting..." });
        }
        const locations = await db.collection("locations").find({}).toArray();
        res.json({
            status: "success",
            data: locations
        });
    } catch (error) {
        console.error("Location error:", error.message);
        res.status(500).json({
            status: "error",
            message: "Unable to fetch locations"
        });
    }
});

// Get rooms from MongoDB
app.get("/api/rooms", async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ status: "error", message: "Database connecting..." });
        }
        const rooms = await db.collection("rooms").find({}).toArray();
        res.json({
            status: "success",
            data: rooms
        });
    } catch (error) {
        console.error("Room error:", error.message);
        res.status(500).json({
            status: "error",
            message: "Unable to fetch rooms"
        });
    }
});

// Start server immediately so Render stays running
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});