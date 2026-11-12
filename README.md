# MedTech

A telemedicine kiosk for towns where the nearest specialist is a bus ride away.

[Live demo](https://medtech.awasthi.tech)

## Why we built it

In a lot of rural and semi-urban places, a routine consultation still means a day of travel. The pharmacy or the small clinic is in the village. The doctor who should see the case often is not.

MedTech puts that first visit in the local place. A patient records vitals at a kiosk, speaks to a verified doctor over video, and leaves with a digital prescription the pharmacy next door can fill. It started as a Smart India Hackathon problem. The gap was larger than a competition entry, so we built it as a platform.

## What it changes

- The patient does not travel for the first opinion.
- The doctor sees live vitals, not a verbal guess: heart rate, blood pressure, temperature, and SpO2.
- The prescription is digital and reaches the pharmacy at the kiosk, so the medicine does not depend on a second trip.
- The record stays with the patient for the next visit.

## How a visit works

**1. Arrive.** The kiosk sits at a pharmacy, campus, clinic, or community center. The patient signs in to the patient portal.

![Kiosk home, with portals for patient, doctor, pharmacy, admin, and delivery](docs/demo/home.jpg)

**2. Report.** They enter the condition, the symptoms, and how long it has lasted. The kiosk reads vitals while they wait.

![Patient dashboard and consultation form](docs/demo/patient.jpg)

**3. Consult.** A doctor in the matching specialty is assigned. The call shows the patient and the live vitals on one screen. The doctor writes the prescription from that same view.

![Doctor consult with video and live vitals](docs/demo/consult.jpg)

**4. Fill.** The pharmacy sees the prescription against current stock and can dispense from the same location. A delivery agent covers orders that have to leave the kiosk.

![Pharmacy inventory](docs/demo/pharmacy.jpg)

## Who uses it

| Role | Job |
| --- | --- |
| Patient | Profile, consultation request, video call, prescriptions |
| Doctor | Queue, live vitals, prescription |
| Pharmacy | Stock and fulfillment |
| Admin | Operations across the kiosk |
| Delivery | Orders that leave the site |

## Stack

React, TypeScript, and Tailwind on the kiosk. FastAPI and Socket.IO for the API and the live call. PostgreSQL on Neon. The API runs on AWS EC2.

## Run locally

```bash
git clone https://github.com/Pradeep-gif-hub/MedTech.git
cd MedTech

cd healthconnect-backend
pip install -r requirements.txt
python -m uvicorn main:app --reload

cd ../healthconnect-frontend
npm install
npm run dev
```

Set `GOOGLE_CLIENT_ID` before starting the backend if you want Google sign-in. `setup-local.sh` walks through that.

## Team

Pradeep Kumar Awasthi, with Vishal, Hardik Agarwal, Paarth Lalit, Gunjan Saini, and Nikita.

[GitHub](https://github.com/Pradeep-gif-hub) · [LinkedIn](https://www.linkedin.com/in/pradeep-kumar-awasthi-9313a2280/)
