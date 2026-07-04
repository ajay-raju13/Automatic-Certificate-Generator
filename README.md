# Automatic Certificate Generator

A full-stack web application that automates the generation of personalized certificates in bulk using a certificate template and Excel data.

## Overview

This project helps reduce the manual effort required to create certificates for events, workshops, seminars, and competitions. Users can upload a template, map placeholders to recipient data, and generate certificates automatically.

## Features

- Upload certificate template
- Upload Excel recipient data
- Map placeholders like name, date, course, and event
- Generate certificates in bulk
- Download output files
- Clean file handling and output management

## Tech Stack

**Frontend**
- React
- Vite
- CSS

**Backend**
- FastAPI
- Python

**Libraries**
- Pandas
- OpenPyXL
- Pillow
- ReportLab

## Getting Started

### Backend
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```powershell
cd frontend
npm install
npm run dev
```

## Access

- Frontend: http://localhost:5173
- Backend API Docs: http://localhost:8000/docs

## Status

This project is still a work in progress and will continue to improve.

## GitHub

Repository: https://github.com/ajay-raju13/Automatic-Certificate-Generator

## License

This project is licensed under the MIT License.

Plain English: anyone can use, copy, modify, and share this project for personal or commercial use, as long as they keep the copyright notice and license text.

If you reuse this project, please keep credit to Ajay Raju.
