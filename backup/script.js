async function fetchDashboard() {
    try {
        let response = await fetch("/dashboard");
        let data = await response.json();
        
        let dashboardDiv = document.getElementById("dashboard");
        dashboardDiv.innerHTML = "<h3>Latest Detections</h3>";
        
        data.forEach(record => {
            dashboardDiv.innerHTML += `
                <p><strong>${record[1]}</strong>: Houses - ${record[2]}, Floods - ${record[3]}, Severity - <strong>${record[4]}</strong></p>
            `;
        });

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    }
}

setInterval(fetchDashboard, 5000);
fetchDashboard();
