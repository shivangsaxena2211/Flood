from flask import Flask, render_template, request, send_from_directory, send_file, url_for, jsonify
from ultralytics import YOLO
import os
import cv2
import numpy as np
import folium
from fpdf import FPDF
from datetime import datetime

app = Flask(__name__)


model_path = os.path.join("model", "best_model.pt")
model = YOLO(model_path)


os.makedirs("damage", exist_ok=True)
os.makedirs("reports", exist_ok=True)

@app.route('/')
def index():
    return render_template("index.html", results_data=[], mode="user")

@app.route('/upload', methods=['POST'])
def upload():
    mode = request.form.get("mode", "user")
    uploaded_files = request.files.getlist("file")

    if mode == "user" and len(uploaded_files) > 1:
        return "User Mode only supports 1 image at a time!", 400

    results_data = []

    for uploaded_file in uploaded_files:
        if uploaded_file.filename == '':
            continue

        image_path = os.path.join("damage", uploaded_file.filename)
        uploaded_file.save(image_path)

            
        results = model.predict(image_path, save=True, save_dir="damage")

    
        detections = results[0].boxes
        class_names = results[0].names or {0: 'flood', 1: 'house'}

        houses = 0
        flooded_areas = 0
        detection_details = []
        severity = "Low"

        heatmap = np.zeros((720, 1280), dtype=np.float32)

        for box in detections:
            try:
                cls_index = int(box.cls.item()) if hasattr(box.cls, 'item') else int(box.cls)
                if cls_index in class_names:
                    class_name = class_names[cls_index]
                    confidence = float(box.conf)
                    coordinates = box.xyxy.cpu().tolist()

                    detection_details.append({
                        "class": class_name,
                        "confidence": round(confidence, 2),
                        "coordinates": [[round(coord, 2) for coord in bbox] for bbox in coordinates]
                    })

                    if class_name == 'house':
                        houses += 1
                    elif class_name == 'flood':
                        flooded_areas += 1
                        for coord in coordinates:
                            x1, y1, x2, y2 = map(int, coord)
                            heatmap[y1:y2, x1:x2] += confidence

            except Exception as e:
                print(f"Error processing box: {e}")

        
        if flooded_areas >= 10:
            severity = "Severe"
        elif 5 <= flooded_areas < 10:
            severity = "Moderate"
        else:
            severity = "Mild"

        
        img = cv2.imread(image_path)
        heatmap = cv2.resize(heatmap, (img.shape[1], img.shape[0]))
        heatmap = cv2.applyColorMap((heatmap * 255).astype(np.uint8), cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(img, 0.6, heatmap, 0.4, 0)
        heatmap_filename = f"heatmap_{uploaded_file.filename}"
        heatmap_path = os.path.join("damage", heatmap_filename)
        cv2.imwrite(heatmap_path, overlay)

        
        pdf_filename = generate_report(uploaded_file.filename, houses, flooded_areas, severity)

        results_data.append({
            "image": uploaded_file.filename,
            "heatmap": heatmap_filename,
            "houses": houses,
            "flooded_areas": flooded_areas,
            "severity": severity,
            "detections": detection_details,
            "pdf": pdf_filename
        })

    return render_template("index.html", results_data=results_data, mode=mode)

def generate_report(filename, houses, flooded_areas, severity):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    pdf.cell(200, 10, txt="Damage Assessment Report", ln=True, align="C")
    pdf.ln(10)

    pdf.cell(200, 10, txt=f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ln=True)
    pdf.ln(5)
    pdf.cell(200, 10, txt=f"Image: {filename}", ln=True)
    pdf.ln(5)
    pdf.cell(200, 10, txt=f"Houses Detected: {houses}", ln=True)
    pdf.ln(5)
    pdf.cell(200, 10, txt=f"Flooded Areas Detected: {flooded_areas}", ln=True)
    pdf.ln(5)
    pdf.cell(200, 10, txt=f"Damage Severity: {severity}", ln=True)

    pdf_filename = f"report_{os.path.splitext(filename)[0]}.pdf"
    pdf_path = os.path.join("reports", pdf_filename)

    os.makedirs("reports", exist_ok=True)
    pdf.output(pdf_path)

    return pdf_filename

@app.route('/damage/<path:filename>')
def damage_files(filename):
    return send_from_directory("damage", filename)

@app.route('/reports/<path:filename>')
def report_files(filename):
    return send_from_directory("reports", filename, as_attachment=True)

@app.route('/dashboard_data')
def dashboard_data():
    
    import random
    return jsonify({
        "total_images": random.randint(5, 20),
        "detected_houses": random.randint(2, 15),
        "detected_floods": random.randint(1, 10),
        "severe_cases": random.randint(0, 5),
    })

@app.route('/map')
def map_view():
    map_center = [37.7749, -122.4194]
    my_map = folium.Map(location=map_center, zoom_start=10)

    folium.Marker([37.7749, -122.4194], popup="Affected Area 1").add_to(my_map)
    folium.Marker([37.7849, -122.4094], popup="Affected Area 2").add_to(my_map)

    map_path = "templates/map.html"
    my_map.save(map_path)

    return send_file(map_path)

if __name__ == "__main__":
    app.run(debug=True)

