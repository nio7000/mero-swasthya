import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import MedicalReport, User, Prescription
from app.pharmacy_admin.models_pharmacy import Bill, BillItem
from passlib.context import CryptContext
from datetime import datetime, timedelta
import random

db  = SessionLocal()
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

print("Starting seed...")

DOCTORS = [
    {"full_name":"Rajesh Kumar Sharma", "email":"rajesh@meroswasthya.com", "specialization":"General Physician"},
    {"full_name":"Sita Devi Adhikari",  "email":"sita@meroswasthya.com",   "specialization":"Gynecologist"},
    {"full_name":"Bikram Thapa",        "email":"bikram@meroswasthya.com", "specialization":"Orthopedist"},
    {"full_name":"Sunita Rai",          "email":"sunita@meroswasthya.com", "specialization":"Dermatologist"},
    {"full_name":"Anil Bahadur Gurung", "email":"anil@meroswasthya.com",   "specialization":"Cardiologist"},
]

for d in DOCTORS:
    if not db.query(User).filter(User.email == d["email"]).first():
        db.add(User(full_name=d["full_name"], email=d["email"], password=pwd.hash("123"), role="doctor", specialization=d["specialization"]))
        print(f"  + Doctor: {d['full_name']}")
    else:
        print(f"  = Exists: {d['email']}")
db.commit()
doctors = db.query(User).filter(User.role == "doctor").all()

PATIENTS = [
    ("Nirmala Shrestha",      34,"Female","9801234567","Kathmandu-5",   "PA000101"),
    ("Ramesh Bahadur Thapa",  52,"Male",  "9812345678","Lalitpur-3",    "PA000102"),
    ("Gita Kumari Poudel",    28,"Female","9823456789","Bhaktapur-7",   "PA000103"),
    ("Suresh Prasad Mainali", 45,"Male",  "9834567890","Pokhara-12",    "PA000104"),
    ("Anita Gurung",          23,"Female","9845678901","Chitwan-4",     "PA000105"),
    ("Bikash Maharjan",       38,"Male",  "9856789012","Kathmandu-17",  "PA000106"),
    ("Sunita Tamang",         41,"Female","9867890123","Dharan-8",      "PA000107"),
    ("Kamal Raj Karki",       60,"Male",  "9878901234","Biratnagar-2",  "PA000108"),
    ("Laxmi Devi Yadav",      31,"Female","9889012345","Janakpur-5",    "PA000109"),
    ("Dipesh Khadka",         27,"Male",  "9890123456","Butwal-9",      "PA000110"),
    ("Saraswati Adhikari",    55,"Female","9801122334","Dhankuta-3",    "PA000111"),
    ("Manoj Basnet",          44,"Male",  "9812233445","Hetauda-6",     "PA000112"),
    ("Parbati Limbu",         36,"Female","9823344556","Ilam-2",        "PA000113"),
    ("Gopal Prasad Ghimire",  70,"Male",  "9834455667","Palpa-1",       "PA000114"),
    ("Bimala Rana",           29,"Female","9845566778","Syangja-4",     "PA000115"),
    ("Raju Shrestha",         48,"Male",  "9856677889","Rupandehi-7",   "PA000116"),
    ("Kamala Devi Bhandari",  33,"Female","9867788990","Kapilvastu-3",  "PA000117"),
    ("Nabin Giri",            25,"Male",  "9878899001","Gulmi-2",       "PA000118"),
    ("Shanta Koirala",        62,"Female","9889900112","Arghakhanchi-5","PA000119"),
    ("Prakash Magar",         39,"Male",  "9890011223","Myagdi-1",      "PA000120"),
]

DIAGNOSES = {
    "General Physician":["Acute Febrile Illness — Viral Etiology","Upper Respiratory Tract Infection","Type 2 Diabetes Mellitus — Uncontrolled","Essential Hypertension — Grade II","Acute Gastroenteritis","Typhoid Fever — Confirmed","Vitamin D Deficiency","Iron Deficiency Anemia"],
    "Gynecologist":["Polycystic Ovarian Syndrome (PCOS)","Primary Dysmenorrhea","Antenatal Care — 28 Weeks","Menopausal Syndrome","Uterine Fibroid — Conservative Management","Bacterial Vaginosis"],
    "Orthopedist":["Osteoarthritis of Right Knee — Grade III","Lumbar Disc Herniation — L4-L5","Closed Fracture — Distal Radius","Cervical Spondylosis","Plantar Fasciitis","Rotator Cuff Tendinopathy"],
    "Dermatologist":["Atopic Dermatitis — Moderate","Tinea Corporis — Extensive","Acne Vulgaris — Papulopustular","Psoriasis Vulgaris — Plaque Type","Urticaria — Chronic Idiopathic","Contact Dermatitis — Allergic"],
    "Cardiologist":["Hypertensive Heart Disease with LVH","Stable Angina Pectoris — NYHA Class II","Paroxysmal Atrial Fibrillation","Dilated Cardiomyopathy — Early Stage","Dyslipidemia — Mixed Type"],
}

MEDICINES = {
    "General Physician":[
        [{"name":"Paracetamol 500mg","dose":"1-1-1","timing":"After Food","duration":"5 Days"},{"name":"Amoxicillin 500mg","dose":"1-0-1","timing":"After Food","duration":"7 Days"}],
        [{"name":"Metformin 500mg","dose":"1-0-1","timing":"After Food","duration":"1 Month"},{"name":"Amlodipine 5mg","dose":"1-0-0","timing":"Before Food","duration":"1 Month"}],
        [{"name":"ORS Sachet","dose":"1-1-1","timing":"After Food","duration":"3 Days"},{"name":"Domperidone 10mg","dose":"1-1-1","timing":"Before Food","duration":"5 Days"}],
    ],
    "Gynecologist":[
        [{"name":"Folic Acid 5mg","dose":"1-0-0","timing":"After Food","duration":"1 Month"},{"name":"Iron Sucrose 200mg","dose":"1-0-0","timing":"After Food","duration":"15 Days"}],
        [{"name":"Mefenamic Acid 500mg","dose":"1-1-1","timing":"After Food","duration":"5 Days"},{"name":"Tranexamic Acid 500mg","dose":"1-0-1","timing":"After Food","duration":"5 Days"}],
    ],
    "Orthopedist":[
        [{"name":"Diclofenac 75mg","dose":"1-0-1","timing":"After Food","duration":"10 Days"},{"name":"Pantoprazole 40mg","dose":"1-0-0","timing":"Before Food","duration":"10 Days"},{"name":"Calcium + Vit D3","dose":"0-1-0","timing":"After Food","duration":"1 Month"}],
        [{"name":"Pregabalin 75mg","dose":"0-0-1","timing":"After Food","duration":"15 Days"},{"name":"Methocarbamol 750mg","dose":"1-1-1","timing":"After Food","duration":"7 Days"}],
    ],
    "Dermatologist":[
        [{"name":"Cetirizine 10mg","dose":"0-0-1","timing":"After Food","duration":"10 Days"},{"name":"Clobetasol Cream 0.05%","dose":"0-1-0","timing":"After Food","duration":"7 Days"}],
        [{"name":"Fluconazole 150mg","dose":"1-0-0","timing":"After Food","duration":"7 Days"},{"name":"Clotrimazole Cream 1%","dose":"0-0-1","timing":"After Food","duration":"14 Days"}],
    ],
    "Cardiologist":[
        [{"name":"Atorvastatin 40mg","dose":"0-0-1","timing":"After Food","duration":"1 Month"},{"name":"Aspirin 75mg","dose":"1-0-0","timing":"After Food","duration":"1 Month"},{"name":"Ramipril 5mg","dose":"1-0-0","timing":"Before Food","duration":"1 Month"}],
        [{"name":"Metoprolol 25mg","dose":"1-0-1","timing":"After Food","duration":"1 Month"},{"name":"Furosemide 40mg","dose":"1-0-0","timing":"After Food","duration":"15 Days"}],
    ],
}

PHARMACY_ITEMS = [
    {"name":"Paracetamol 500mg","price":5,"qty_range":(10,30)},
    {"name":"Amoxicillin 500mg","price":18,"qty_range":(14,21)},
    {"name":"Metformin 500mg","price":8,"qty_range":(30,60)},
    {"name":"Amlodipine 5mg","price":12,"qty_range":(30,30)},
    {"name":"Diclofenac 75mg","price":15,"qty_range":(10,20)},
    {"name":"Cetirizine 10mg","price":6,"qty_range":(10,20)},
    {"name":"Atorvastatin 40mg","price":22,"qty_range":(30,30)},
    {"name":"Aspirin 75mg","price":4,"qty_range":(30,30)},
    {"name":"Pantoprazole 40mg","price":10,"qty_range":(10,30)},
    {"name":"Calcium + Vit D3","price":14,"qty_range":(30,30)},
    {"name":"Folic Acid 5mg","price":3,"qty_range":(30,30)},
    {"name":"Fluconazole 150mg","price":35,"qty_range":(7,14)},
    {"name":"Pregabalin 75mg","price":28,"qty_range":(15,30)},
    {"name":"Ramipril 5mg","price":16,"qty_range":(30,30)},
    {"name":"Metoprolol 25mg","price":11,"qty_range":(30,60)},
    {"name":"ORS Sachet","price":8,"qty_range":(5,10)},
    {"name":"Domperidone 10mg","price":7,"qty_range":(10,15)},
    {"name":"Furosemide 40mg","price":9,"qty_range":(15,30)},
]

def rdate(a,b):
    return datetime.utcnow() - timedelta(days=random.randint(a,b))

print("\nSeeding patients...")
patient_db_ids = []
for (name,age,sex,contact,address,pid) in PATIENTS:
    existing = db.query(MedicalReport).filter(MedicalReport.patient_name == name).first()
    if existing:
        patient_db_ids.append(existing.id)
        print(f"  = {name}")
        continue
    r = MedicalReport(
        patient_name=name, age=str(age), sex=sex,
        json_data={"structured_data":{"Patient Name":name,"Age":str(age),"Sex":sex,"Contact":contact,"Address":address,"Patient ID":pid},"medical_analysis":{}},
        is_deleted=False,
    )
    db.add(r); db.flush()
    patient_db_ids.append(r.id)
    print(f"  + {name}")
db.commit()

print("\nSeeding prescriptions...")
for i, pid in enumerate(patient_db_ids):
    if db.query(Prescription).filter(Prescription.patient_id == pid).first():
        print(f"  = Exists for patient_id={pid}"); continue
    doc   = doctors[i % len(doctors)]
    spec  = doc.specialization
    dlist = DIAGNOSES.get(spec, DIAGNOSES["General Physician"])
    mlist = MEDICINES.get(spec,  MEDICINES["General Physician"])
    days  = random.randint(1,175)
    db.add(Prescription(patient_id=pid, diagnosis=dlist[i%len(dlist)], medicines={"doctor":doc.full_name,"items":mlist[i%len(mlist)]}, tests=["No tests selected"], status="Active", created_at=(datetime.utcnow()-timedelta(days=days)).isoformat()))
    print(f"  + {dlist[i%len(dlist)][:50]}")
    if i % 3 == 0:
        d2 = dlist[(i+1)%len(dlist)]
        db.add(Prescription(patient_id=pid, diagnosis=d2, medicines={"doctor":doc.full_name,"items":mlist[(i+2)%len(mlist)]}, tests=["No tests selected"], status="Active", created_at=(datetime.utcnow()-timedelta(days=random.randint(1,max(1,days-1)))).isoformat()))
        print(f"  + follow-up: {d2[:50]}")
db.commit()

print("\nSeeding bills...")
SCHEDULE = [
    (0,165,175),(1,160,170),(2,155,165),(3,145,155),(4,140,150),(5,135,145),
    (6,120,130),(7,118,128),(8,115,125),(9,110,120),
    (10,90,100),(11,88,98),(12,85,95),(13,82,92),
    (14,60,70),(15,58,68),(16,55,65),(17,52,62),
    (18,25,35),(19,22,32),
    (2,20,30),(5,18,28),(8,15,25),
    (0,10,18),(11,8,15),(14,5,12),
    (3,2,6),(16,1,4),(1,1,3),
]
for (idx,dmin,dmax) in SCHEDULE:
    if idx >= len(patient_db_ids): continue
    chosen = random.sample(PHARMACY_ITEMS, random.randint(2,4))
    total  = 0; items = []
    for it in chosen:
        qty=random.randint(*it["qty_range"]); sub=it["price"]*qty; total+=sub
        items.append({"name":it["name"],"price":it["price"],"qty":qty,"subtotal":sub})
    disc=random.choice([0,0,0,5,10]); net=round(total-total*disc/100,2)
    pay=random.choice(["cash","cash","cash","qr"]); bd=rdate(dmin,dmax)
    bill=Bill(patient_id=patient_db_ids[idx],total_amount=total,discount=disc,net_total=net,status="paid",payment_method=pay,created_at=bd)
    db.add(bill); db.flush()
    for it in items:
        db.add(BillItem(bill_id=bill.id,medicine_id=0,medicine_name=it["name"],qty=it["qty"],price=it["price"],subtotal=it["subtotal"]))
    print(f"  + Rs.{net:,.0f} | {bd.strftime('%Y-%m-%d')} | {pay}")
db.commit(); db.close()
print("\nDone! 20 patients | 5 doctors | 25+ prescriptions | 29 bills | password: 123")
