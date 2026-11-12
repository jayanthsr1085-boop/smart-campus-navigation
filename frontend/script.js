const API_BASE = "https://smart-campus-backend-liew.onrender.com/api";

// =====================================
// 1. HTML ELEMENTS
// =====================================

const startLocation = document.getElementById("startLocation");
const endLocation = document.getElementById("endLocation");
const navigateButton = document.getElementById("navigateButton");
const result = document.getElementById("result");

const roomType = document.getElementById("roomType");
const roomSelect = document.getElementById("roomSelect");
const customRoom = document.getElementById("customRoom");
const sectionSelect = document.getElementById("sectionSelect");
const batchSelect = document.getElementById("batchSelect");

const availabilityDay = document.getElementById("availabilityDay");
const availabilityTime = document.getElementById("availabilityTime");

const checkAvailabilityButton =
    document.getElementById("checkAvailabilityButton");

const availabilityResult =
    document.getElementById("availabilityResult");


// =====================================
// 2. ORIGINAL 13 CAMPUS LOCATIONS
// =====================================

const campusLocations = [
    {
        name: "Central Library",
        lat: 12.964603,
        lng: 77.505563
    },
    {
        name: "Dr AIT Auditorium",
        lat: 12.963446,
        lng: 77.505928
    },
    {
        name: "Main Gate",
        lat: 12.964310,
        lng: 77.505188
    },
    {
        name: "Student Parking",
        lat: 12.964157,
        lng: 77.505232
    },
    {
        name: "Ambedkar Park",
        lat: 12.963021,
        lng: 77.505350
    },
    {
        name: "Ambedkar Statue",
        lat: 12.963156,
        lng: 77.505421
    },
    {
        name: "ISE Department",
        lat: 12.963763,
        lng: 77.506467
    },
    {
        name: "Mechanical Department",
        lat: 12.964046,
        lng: 77.506642
    },
    {
        name: "college Canteen",
        lat: 12.964419,
        lng: 77.505241
    },
    {
        name: "Boys Hostel",
        lat: 12.966004,
        lng: 77.505694
    },
    {
        name: "Indoor Stadium",
        lat: 12.964938,
        lng: 77.506016
    },
    {
        name: "College Ground",
        lat: 12.965528,
        lng: 77.506354
    },
    {
        name: "CSE Department",
        lat: 12.963209,
        lng: 77.506152
    }
];

// =====================================
// 3. DATABASE DATA
// =====================================

let databaseLocations = [];
let allRooms = [];
let timetableData = null; // New variable for timetable

const locationMarkers = new Map();
let campusGraph = null;
let currentRouteLine = null;

// =====================================
// 4. HTML SECURITY
// =====================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function(char) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[char];
    });
}


// =====================================
// 5. CREATE CAMPUS MAP
// =====================================

const map = L.map("map").setView(
    [12.9646, 77.505563],
    17
);

L.tileLayer(
    "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
    {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }
).addTo(map);


// =====================================
// 6. COLLEGE MARKER
// =====================================

const campusMarker = L.marker([
    12.9646,
    77.50659
]).addTo(map);

campusMarker.bindPopup(
    "<b>Dr. Ambedkar Institute of Technology</b>"
);


// =====================================
// 7. ADD ALL 13 MAP MARKERS
// =====================================

campusLocations.forEach(function(location) {

    const marker = L.marker([
        location.lat,
        location.lng
    ]).addTo(map);

    marker.bindPopup(`
        <b>${escapeHTML(location.name)}</b>
        <br>
        Latitude: ${location.lat}
        <br>
        Longitude: ${location.lng}
    `);

    locationMarkers.set(location.name, marker);

});

console.log("All 13 original campus markers added.");


// =====================================
// 8. LOAD LOCATIONS FROM MONGODB
// =====================================

async function loadLocations() {

    try {

        const response = await fetch(
            `${API_BASE}/locations`
        );

        if (!response.ok) {
            throw new Error("Unable to fetch locations");
        }

        const responseData = await response.json();

        if (responseData.status !== "success") {
            throw new Error("Locations API error");
        }

        databaseLocations = responseData.data;

        // Populate dropdown using MongoDB records

        startLocation.innerHTML = '<option value="">Select starting location</option>';
        endLocation.innerHTML = '<option value="">Select destination</option>';

        databaseLocations.forEach(function(location) {
            const startOption = document.createElement("option");
            startOption.value = location.name; // Use the actual name for the graph
            startOption.textContent = location.name;
            startLocation.appendChild(startOption);

            const endOption = document.createElement("option");
            endOption.value = location.name;
            endOption.textContent = location.name;
            endLocation.appendChild(endOption);
        });

        console.log(
            "MongoDB locations loaded:",
            databaseLocations
        );

    }

    catch (error) {

        console.error("Location loading error:", error);

        result.textContent =
            "Unable to load database locations.";

    }

}


// =====================================
// 9. LOCATION NAME TO MAP MARKER
// =====================================

function findMapLocation(databaseName) {

    const name = databaseName.toLowerCase();

    const aliases = {
        "central library": "Library",
        "college canteen": "Canteen"
    };

    if (aliases[name]) {
        return campusLocations.find(function(location) {
            return location.name === aliases[name];
        });
    }

    return campusLocations.find(function(location) {

        return location.name.toLowerCase() === name;

    });

}

// =====================================
// 10. A* PATHFINDING ALGORITHM
// =====================================

// Helper function to calculate straight-line distance (Heuristic)
function heuristic(nodeA, nodeB) {
    const locA = campusLocations.find(l => l.name === nodeA);
    const locB = campusLocations.find(l => l.name === nodeB);
    if (!locA || !locB) return 0;
    return map.distance([locA.lat, locA.lng], [locB.lat, locB.lng]);
}

navigateButton.addEventListener("click", function() {
    const start = startLocation.value;
    const goal = endLocation.value;

    if (!start || !goal) {
        result.innerHTML = "<p>Please select both a start and destination.</p>";
        return;
    }

    if (start === goal) {
        result.innerHTML = "<p>You are already at your destination!</p>";
        return;
    }

    if (!campusGraph || !campusGraph[start] || !campusGraph[goal]) {
        result.innerHTML = "<p>Pathfinding data for these locations is incomplete.</p>";
        return;
    }

    // A* Algorithm Initialization
    let openSet = [start];
    let cameFrom = {};
    let gScore = {};
    let fScore = {};

    for (let node in campusGraph) {
        gScore[node] = Infinity;
        fScore[node] = Infinity;
    }

    gScore[start] = 0;
    fScore[start] = heuristic(start, goal);

    // A* Loop
    while (openSet.length > 0) {
        // Find node with lowest fScore
        let current = openSet[0];
        let lowestF = fScore[current];
        for (let i = 1; i < openSet.length; i++) {
            if (fScore[openSet[i]] < lowestF) {
                current = openSet[i];
                lowestF = fScore[openSet[i]];
            }
        }

        // If we reached the destination
        if (current === goal) {
            let path = [current];
            let totalDistance = gScore[current];
            
            while (cameFrom[current]) {
                current = cameFrom[current];
                path.unshift(current);
            }

            drawPathOnMap(path, totalDistance);
            return;
        }

        openSet = openSet.filter(node => node !== current);
        let neighbors = campusGraph[current];

        for (let neighbor in neighbors) {
            let tentative_gScore = gScore[current] + neighbors[neighbor];

            if (tentative_gScore < gScore[neighbor]) {
                cameFrom[neighbor] = current;
                gScore[neighbor] = tentative_gScore;
                fScore[neighbor] = gScore[neighbor] + heuristic(neighbor, goal);

                if (!openSet.includes(neighbor)) {
                    openSet.push(neighbor);
                }
            }
        }
    }

    result.innerHTML = "<p>No walking route found between these locations.</p>";
});

function drawPathOnMap(pathArray, distance) {
    // Clear previous route if it exists
    if (currentRouteLine) {
        map.removeLayer(currentRouteLine);
    }

    // Get coordinates for the path
    let latlngs = [];
    pathArray.forEach(nodeName => {
        let loc = campusLocations.find(l => l.name === nodeName);
        if (loc) latlngs.push([loc.lat, loc.lng]);
    });

    // Draw the line on the map
    currentRouteLine = L.polyline(latlngs, {color: '#dc2626', weight: 5, opacity: 0.8}).addTo(map);
    
    // Zoom map to fit the route
    map.fitBounds(currentRouteLine.getBounds(), { padding: [30, 30] });

    result.innerHTML = `
        <h3 style="margin-top:0;">Route Found!</h3>
        <p><strong>Path:</strong> ${pathArray.join(" ➔ ")}</p>
        <p><strong>Approximate Distance:</strong> ${distance} meters</p>
        <p><strong>Estimated Walk Time:</strong> ${Math.ceil(distance / 80)} minutes</p>
    `;
}

// =====================================
// 11. LOAD ROOMS FROM MONGODB
// =====================================

async function loadRooms() {

    try {

        const response = await fetch(
            `${API_BASE}/rooms`
        );

        if (!response.ok) {
            throw new Error("Unable to fetch rooms");
        }

        const responseData = await response.json();

        if (responseData.status !== "success") {
            throw new Error("Rooms API error");
        }

        allRooms = responseData.data;

        roomType.disabled = false;

        console.log("MongoDB rooms loaded:", allRooms);

    }

    catch (error) {

        console.error("Room loading error:", error);

        availabilityResult.innerHTML =
            "<p>Unable to load rooms. Check backend connection.</p>";

    }

}
// =====================================
// 11.5 LOAD TIMETABLE FROM BACKEND
// =====================================

async function loadTimetable() {
    try {
        const response = await fetch(`${API_BASE}/timetable`);

        if (!response.ok) {
            throw new Error("Unable to fetch timetable");
        }

        const responseData = await response.json();

        if (responseData.status !== "success") {
            throw new Error("Timetable API error");
        }

        timetableData = responseData.data;
        console.log("Timetable loaded successfully:", timetableData);

    } catch (error) {
        console.error("Timetable loading error:", error);
    }
}

// =====================================
// 12. UPDATE ROOM DROPDOWN
// =====================================

roomType.addEventListener("change", function() {

    const selectedType = roomType.value;

    roomSelect.innerHTML =
        '<option value="">Select a room</option>';

    roomSelect.disabled = true;

    customRoom.value = "";

    availabilityResult.innerHTML =
        "<p>Choose a room, day and time to continue.</p>";

    if (selectedType === "") {
        return;
    }

    const filteredRooms = allRooms.filter(function(room) {

        return room.type === selectedType;

    });

    if (filteredRooms.length === 0) {

        availabilityResult.innerHTML =
            "<p>No rooms found for this room type.</p>";

        return;

    }

    filteredRooms.forEach(function(room) {

        const option = document.createElement("option");

        option.value = room.roomNumber;

        option.textContent =
            room.roomNumber + " - " + room.name;

        roomSelect.appendChild(option);

    });

    roomSelect.disabled = false;

});
// =====================================
// 13. CHECK ROOM AVAILABILITY
// =====================================

checkAvailabilityButton.addEventListener("click", function() {

    const selectedType = roomType.value;
    const selectedRoom = customRoom.value.trim() || roomSelect.value;
    const selectedSection = sectionSelect.value;
    const selectedBatch = batchSelect.value;
    const selectedDay = availabilityDay.value;
    const selectedTime = availabilityTime.value; 

    if (selectedType === "" || selectedRoom === "" || selectedDay === "" || selectedTime === "") {
        availabilityResult.innerHTML = "<p>Please select Room Type, Room, Day, and Time.</p>";
        return;
    }

    if (!timetableData) {
        availabilityResult.innerHTML = "<p>Timetable data is still loading. Please try again in a moment.</p>";
        return;
    }

    const roomDetails = allRooms.find(function(room) {
        return room.roomNumber.toLowerCase() === selectedRoom.toLowerCase();
    });

    let isOccupied = false;
    let occupiedMessage = "";

    // 1. Loop through all sections in the timetable
    const sections = timetableData.sections;
    
    for (const secKey in sections) {
        const sectionData = sections[secKey];
        
        // 2. Check if the section has classes on the selected day
        if (sectionData.schedule && sectionData.schedule[selectedDay]) {
            const daySchedule = sectionData.schedule[selectedDay];
            
            // 3. Find the exact time slot (e.g., "09:00" or "13:45")
            const timeSlot = daySchedule[selectedTime]; 

            if (timeSlot) {
                // 4. Check if it's a theory class occupying our selected room
                if (timeSlot.type === "theory" && timeSlot.room === selectedRoom) {
                    isOccupied = true;
                    occupiedMessage = `Occupied by Section ${secKey} (Theory: ${timeSlot.subject})`;
                    break;
                } 
                // 5. Check if it's a lab batch occupying our selected room
                else if (timeSlot.type === "lab" && timeSlot.batches) {
                    for (const batchKey in timeSlot.batches) {
                        if (timeSlot.batches[batchKey] === selectedRoom) {
                            isOccupied = true;
                            occupiedMessage = `Occupied by Lab Batch ${batchKey}`;
                            break;
                        }
                    }
                }
            }
        }
        if (isOccupied) break;
    }

    // 6. Output the final HTML based on the status
    const statusHtml = isOccupied 
        ? `<strong style="color: #dc2626; font-size: 1.3em;">OCCUPIED</strong><br><span style="color: #475569;">${occupiedMessage}</span>` 
        : `<strong style="color: #16a34a; font-size: 1.3em;">FREE</strong><br><span style="color: #475569;">No classes are scheduled to start at this exact time.</span>`;

    availabilityResult.innerHTML = `
        <div style="padding: 16px; background: white; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 16px;">
            <h3 style="margin-top: 0;">Status</h3>
            ${statusHtml}
        </div>

        <h3>Selection Details</h3>
        <p><strong>Room:</strong> ${escapeHTML(selectedRoom)} (${escapeHTML(roomDetails?.name || "Unknown")})</p>
        <p><strong>Your Profile:</strong> Section ${escapeHTML(selectedSection || "None")} | Batch ${escapeHTML(selectedBatch || "None")}</p>
        <p><strong>Checked for:</strong> ${escapeHTML(selectedDay)} at ${escapeHTML(selectedTime)}</p>
    `;

});
// =====================================
// 13.5 LOAD CAMPUS GRAPH
// =====================================

async function loadGraph() {
    try {
        const response = await fetch(`${API_BASE}/graph`);
        const responseData = await response.json();
        if (responseData.status === "success") {
            campusGraph = responseData.data;
            console.log("Graph loaded:", campusGraph);
        }
    } catch (error) {
        console.error("Graph loading error:", error);
    }
}
// =====================================
// 14. START FRONTEND
// =====================================

loadLocations();
loadRooms();
loadTimetable(); // Added this line
loadGraph();

// =====================================
// 15. LIVE GPS TRACKING (BLUE DOT)
// =====================================

const locateMeBtn = document.getElementById("locateMeBtn");
let userMarker = null;
let userCircle = null;

locateMeBtn.addEventListener("click", function() {
    if (!navigator.geolocation) {
        alert("Your browser does not support GPS location.");
        return;
    }

    alert("Requesting GPS access. Please click 'Allow' on your phone.");

    // watchPosition continuously updates as the user walks
    navigator.geolocation.watchPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy; // How accurate the GPS is right now

            if (userMarker) {
                // If the blue dot already exists, just move it to the new step
                userMarker.setLatLng([lat, lng]);
                userCircle.setLatLng([lat, lng]);
                userCircle.setRadius(accuracy);
            } else {
                // First time finding the user: Create the blue dot!
                
                // The light blue radius showing accuracy
                userCircle = L.circle([lat, lng], {
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.2,
                    radius: accuracy,
                    weight: 1
                }).addTo(map);

                // The solid blue dot for the exact location
                userMarker = L.circleMarker([lat, lng], {
                    color: '#ffffff',
                    fillColor: '#3b82f6',
                    fillOpacity: 1,
                    radius: 8,
                    weight: 2
                }).addTo(map);

                // Instantly zoom the map to where the user is standing
                map.setView([lat, lng], 18);
            }
        },
        function(error) {
            console.error("GPS Error:", error);
            alert("Unable to find you. Please make sure Location Services/GPS is turned on in your phone settings.");
        },
        { 
            enableHighAccuracy: true, // Forces the phone to use real GPS, not just WiFi estimation
            maximumAge: 0,
            timeout: 10000 
        }
    );
});