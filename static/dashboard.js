document.addEventListener("DOMContentLoaded", function () {
    function updateDashboard() {
        fetch("/dashboard_data")
            .then(response => response.json())
            .then(data => {
                document.getElementById("total-images").textContent = data.total_images;
                document.getElementById("detected-houses").textContent = data.detected_houses;
                document.getElementById("detected-floods").textContent = data.detected_floods;
                document.getElementById("severe-cases").textContent = data.severe_cases;
            })
            .catch(error => console.error("Error fetching dashboard data:", error));
    }

    // Update every 5 seconds
    updateDashboard();
    setInterval(updateDashboard, 5000);
});
