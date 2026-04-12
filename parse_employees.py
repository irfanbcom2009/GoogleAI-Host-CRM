import json
import re

data = """1	1-Nov-2023	Ahmed Sadiq													1-Jan-2024	
2	1-Apr-2024	Bilal Akram													2-May-2024	
3	1-Feb-2024	Shaheer													2-May-2024	
4	14-Feb-2024	Hassam Shafiq													11-May-2024	
5	3-May-2024	Ahtisham Asghar	ON Site					35103-7717684-3	92-300-9445243		AL-kHAIR CITY PATTOKI		Male		1-Jun-2024	
6	1-May-2024	Tahir Mahmood					tahirmehmood3755@gmail.com	35103-6913890-5	92-324-4491053	92-301-6802856	Pattoki Badar Colony	FSC (Medical)	Male	CV Missing	30-Jun-2025	
7	1-May-2024	Khizar Ali	ON Site		Articles Generating		khizara845@gmail.com	35103-3321919-9	92-329-8047813	92-324-4516190	Bhaidian chuk no 35 Pattoki	FSC (Engineering)	Male		31-Jul-2025	Fresh
8	1-May-2024	Zohaib Jamshaid	ON Site				zohaibjamshad.pakistan@gmail.com	35101-2757245-1	92-328-0443619	92-300-4845930	Shadman colony Pattoki	BSCS (Continue)	Male		12-Jul-2025	
9	7-May-2024	Farooq Raza	ON Site				faroqraza042@gmail.com		92-302-4060951		Pattoki Old Mandi	F.A	Male		20-May-2024	
10	7-May-2024	Ali Hussnain	ON Site						92-300-0435428		Pattoki Old Mandi		Male		2-Jun-2024	
11	9-May-2024	Husnain Asghar	ON Site						92-300-9445235		AL-KHAIR CITY PATTOKI		Male		4-Jun-2024	
12	10-May-2024	Muhammad Waqas	ON Site						92-300-5084367		Bakar Mandi		Male		13-May-2024	
13	11-May-2024	Atif Shakoor	ON Site						92-3174226756		Shadman colony Pattoki		Male		13-May-2024	
14	11-May-2024	Junaid Zubair	ON Site						92-300-6570160		vaa khara		Male		17-May-2024	
15	11-May-2024	Usama Rasool	ON Site						92-302-8131101		vaa khara		Male		17-May-2024	
16	11-May-2024	Abdur Rahman	ON Site						92-325-0030011		vaa khara		Male		17-May-2024	
17	13-May-2024	Imran Haidar	ON Site						92-326-0764228		Pattoki kohna		Male		29-May-2024	
18	14-May-2024	Zohaib Sami	ON Site					35103-4318543-5	92-321-4281402		Pattoki Old Mandi		Male		3-Jun-2024	
19	14-May-2024	Hussnain Ghulam Nabi	ON Site						92-311-6457011				Male		17-May-2024	
20	15-May-2024	Daod	ON Site										Male		22-May-2024	
21	21-May-2024	Hamid Iqbal	ON Site					35103-9286982-1	92-307-2322672		Shadman colony Pattoki		Male		22-May-2024	
22	6-Aug-2024	Syed Afzal Shah	ON Site				afzaljee186@gmail.com	35103-4418686-5	92-328-6900140		Muzamel Bazar Gali No 10	BA (Islamiyat)	Male		24-Mar-2025	
23	26-Aug-2024	Numan Abu Zar	ON Site					35103-6472185-3	92-333-1403825				Male		13-Mar-2025	
24	28-Aug-2024	Muhammad Abdullah	ON Site					35103-4523701-5	92-323-1840850		Mohallah Malik Pura	Matric (Science)	Male		30-Sep-2024	
25	14-Sep-2024	Tabir Ali	ON Site					35103-4808284-1	92-325-2593923				Male	Confirm Same Name	30-Sep-2024	
26	22-Sep-2024	CHAND AKRAM	ON Site		KJMR + Article Formating + Uplaoding	"chandakram1133@gmail.com

"	chandakram461@gmail.com	35103-6865650-9	92-300-0917734	92-302-6542405	Old mandi chunia road house no 32/5	ADP (CS)	Male		8-Dec-2025	Fesh
27	1-Oct-2024	Hafiz Hamza 	ON Site						92-324-6551553				Male		3-Nov-2024	
28	1-Oct-2024	HAFIZ ABDULLAH	ON Site		OLD > NEW	"muhammad002360@gmail.com
mir50120"	abdullahsaifee002@gmail.com	35103-3471777-7	92-301-7960291	92-340-4144251	shadman colony street no 5 house no 9	MATRIC HIFAZ	Male		8-Dec-2025	Fresh
29	1-Oct-2024	Tabarr Shair Ali	ON Site				tabarrsandhu@gmail.com	35103-1346558-7	92-312-4675747		Kohna Road Pattoki	Intermadiate	Male	Confirm Same Name	1-Jul-2025	
30	10-Oct-2024	Asad Ali Arshad	ON Site				asad.uiux1@gmail.com	35103-6656033-1	92-322-4650142		Bilal Colony Pattoki	Intermadiate	Male		1-Nov-2024	
31	12-Oct-2024	Aqib Shakoor	ON Site						92-317-4226756				Male		4-Nov-2024	
32	15-Oct-2024	Muhammad Aqib Nazir	ON Site				aqib3797@gmail.com	35103-6713014-1	92-348-6799224		Daokey Chak 9 Pattoki	BS (Islamic study)	Male		22-Oct-2024	
33	15-Oct-2024	Muhammad  Ahmad	ON Site				ahmadrazzaq2244@gmail.com	35103-6387236-5	92-301-4397619		Shadman colony Pattoki	Matric	Male		17-Nov-2024	
34	19-Oct-2024	Ali Hamza	ON Site				ALIhamzashahzad028@gmail.com		92-300-4646694		Kohna Road Pattoki	ICOM	Male		5-Nov-2024	
35	21-Oct-2024	Ali Zain	ON Site					35103-8769568-5	92-301-4743120		Kot Fazal Din,Pattoki	ICS (continue)	Male		23-Oct-2024	
36	22-Oct-2024	Umair Munir	ON Site					35302-3472808-7	92-304-8881420		shadman colony street no 6 Pattoki	F.A	Male		28-Oct-2024	
37	24-Nov-2024	Muhammad Kashif Jabbar	ON Site										Male		25-Nov-2024	
38	2-Dec-2024	ZOHAIB JAVED			Remotely (25 Artcile Genarte + Formatting + Uplaoding)/ 1000PKR		zohaibjaved4145@gmail.com	35103-9017458-7	92-308-0006504	92-317-3360043	Muhala malik pura street no/ 02	BSCS (continue)	Male	🔑	31-Jul-2025	Fresh
39	3-Dec-2024	Ali Sadar	ON Site						92-327-0579742				Male		11-Dec-2024	
40	13-Jan-2025	Numan Bashir	ON Site					35103-7480116-3	92-329-4139001		Hallah Road Insaf City Pattoki	Intermediate (ICS)	Male		15-Apr-2025	
41	19-Jan-2025	Abdullah Usman	ON Site										Male		31-Jan-2025	
42	6-Feb-2025	JUNAID ABID			Old To New 100 Article / 1000PKR		junaidbhai557@gmail.com	34602-8681187-7	92-328-6544878	92-300-4938235	Sugar Mill Colony House No B/7	BSCS (continue)	Male		31-Jul-2025	Fresh
43	14-Feb-2025	Ali Shan			Articles Generating		marvelouseshann@gmail.com	35103-4049486-5	92-325-4559012	92-304-4717028	Pattoki Kareem Park	Intermediate	Male		11-Jul-2025	
44	12-Apr-2025	Mubeen Ahmad	ON Site		OJS Backup + Hosting + Visit Old Journals +Template Downlaod + Check Indexing	"mubeenahmad09870@gmail.com 

Pass ( mubeena07890 )"	shkmubeen87@gmail.com	35103-4214752-5	92-303-5903842	92-328-6544817	Madina Colony Street No/03 Near Paragon School	MIDDLE	Male		8-Dec-2025	Fresh
45	16-Apr-2025	Tasveeb Shahid			Remotely (30 Artcile Genarte + Formatting + Uplaoding)	tasveeb.shahid@hostajournal.biz	hassanshahidb01@gmail.com	35103-7809064-8	92-309-5151069	92-300-6588101	Pattoki Old Mandi	Metric	Female		9-Aug-2025	Fresh
46	16-Apr-2025	Sana Abdul Guffar	ON Site		OJS Marketing Department	"Gmail: sanaabbas0728@gmail.com
Password: Sana01012006."	khair2002ali@gmail.com	35103-2637941-4	92-328-9048785	92-307-6803722	Pattoki Old Mandi	Intermediate	Female			Fresh
47	21-Apr-2025	Fakhira Batool	ON Site		OJS Complete  + Concents Team + 1PageCV + CV Database + Office Management  + Marketing	"fakhirabatool.009@gmail.com
f00000009
Pc; 02 Shakeel
(double space)"	fakhirak53@gmail.com	35103-10725496	92-311-6463976	92-303-4033359	Pattoki Bilal Colony	BS Information Technology	Female			Online Sale Purchase + Digital Marketing (2021)
48	26-Apr-2025	Sadia Yousaf	ON Site		Citation	"Sadiayousaf855@gmail.com

Password: sadia@123"	-	35103-51943802	92-309-4435758	92-303-4927570	Pattoki Madina Masjid Old Mandi	Matric	Female	🔑	15-Jan-2026	EFA School System (2021)
49	1-May-2025	Nabeel Anwar	ON Site		 Formatting + Uplaoding + OLD / NEW	nabeel.anwar@hostajournal.biz	saeedalisaeed@gmail.com	35103-2207723-9	92-302-1556749	92-303-2494009	P/O Khas Chak no 45 Padhana Pattoki	FSC (Medical)	Male		16-Oct-2025	Fresh
50	3-May-2025	Hafiz Zunair	ON Site				Zunairhafiz774@gmail.com	35103-0692519-3	92-303-8976567		AlAhmed Town Allama Iqbal Road Pattoki	BSCS (continue)	Male		19-May-2025	
51	5-May-2025	Sawera Riasat			Remotely SCOPUS + DOAJ + WOS (Article Publication)	sawera.riasat@hostajournal.biz	qamarjuttjutt939@gmail.com	35103-8173314-4	92-328-0224893	92-328-0224893	Pattoki Badar Colony	B.Ed (Continue)	Female		30-Jun-2025	HBL Microfinance (Jul2025)
52	27-May-2025	Tayyaba Riasat			Indexing + Google Scholar Indexing + Citescore Increase + DOAJ SCOPUS Indexing	tayyaba.riasat@hostajournal.biz	qamarjuttjutt939@gmail.com	35103-6298518-6	92-317-7457847	92-328-0224893	Pattoki Badar Colony	FSC	Female		1-Nov-2025	Fresh
53	27-May-2025	Tobba Riasat			Formatting + Uplaoding Article (Old/New)	tobba.riasat@hostajournal.biz	qamarjuttjutt939@gmail.com	35103-6298613-6	92-317-7457847	92-328-0224893	Pattoki Badar Colony	Matric	Female		9-Aug-2025	Fresh
54	4-Jun-2025	Rabia Khalid J	ON Site		DOI + Manage Subscriptions + Office Expenses + Profit $ Loss Monthly + ZOHO	"hostajournal12@gmail.com
host@12345
PC04 Rabia
8397"	bia.rajpoot97@gmail.com	35103-9385656-8	92-301-4084397	92-300-4430197	Pattoki Darbar Stop	BBIT	Female			Fresh
55	4-Jun-2025	Bushra Khalid	ON Site		DOAJ + OJS Review Form + Reviews (Current, Before) + Reviewers	"Bushrakhalid6780@gmail.com

zahrafatima786"	bia.rajpoot97@gmail.com	35103-323687-4	92-300-0893748	92-300-4430197	Pattoki Darbar Stop	MA (Islamiyat)	Female			EFA School System (2011)
56	21-Jun-2025	Omar Farooq	ON Site		OJS Backup + Hosting + Visit Old Journals (Template Downlaod + Check Indexing + CSS File)	"omarfarooq6926@gmail.com

uMer@M69"	jumer3503@gmail.com	35103-4393810-1	92-317-7436474	92-308-0006504	Madina Colony Street No/03 Near Paragon School	ICS	Male		8-Dec-2025	Fresh
57	23-Jun-2025	Wisha Noor			Remotely (30 Artcile Genarte + Formatting + Uplaoding)	wisha.noor@hostajournal.biz	786wishanoor@gmail.com	32202-5510514-0	92-329-7311713	92-341-6669555	Burj Mahalam, Chak 35, Pattoki	BSCS	Female		9-Aug-2025	DarArqam (Dec 2023)
58	18-Jun-2025	Sadia Zulifqar	Remotely		50 Indexing Links	sadia.zulifqar@hostajournal.biz	sadiazulfiqar870@gmail.com	35101-8765028-4	92-314-1774838	92-328-4172731	Alhamad Town, Pattoki	MA. English	Female		04-Aug-2025	Online
59	23-Jun-2025	Noria Noor	Remotely			noria.noor@hostajournal.biz	nooriatahreem@gmail.com	32202-5500919-0	92-323-1722017	92-341-6669555	Burj Mahalam, Chak 35, Pattoki	MA English + B-ED	Female		31-04-2025	Educators Teaching (March 2024)
60	23-Jun-2025	Mehmoona Noor	Remotely		Remotely (30 Artcile Genarte + Formatting + Uplaoding)	mehmoona.noor@hostajournal.biz	noormamoona7@gmail.com	32202-3635813-2	92-329-7311713	92-341-6669555	Burj Mahalam, Chak 35, Pattoki	BS(MATH)	Female		9-Aug-2025	Educators Teaching (March 2025)
61	17-Jul-2025	Hafiz Tanveer Ahmad	ON Site		Canva (Cover Pages + Logo + CFP/CFT Designs) + Canva Video Designs (Pending)	hafiztanveerdigital4060@gmail.com		35102-5353141-1	92-301-4060230	92-304-5664580	Asif Colony, Steert 2, Hallah Road, Pattoki	ICS	Male		8-Dec-2025	1.5 Year Account Bahira Orchard
62	1-Aug-2025	Saim Adil				saim.adil@hostajournal.biz	saimkhalil110@gmail.com	35103-9927807-7	92-309-1722175	92-304-8163622	Madina Colony Street No/01 Near Paragon School	Matric	Male		11-Jul-2025	
63	17-Aug-2025	Shakil Asghar	ON Site		50 Accounts CFP (Digital Marketing)		SHAKEELASGHAR771@GMAIL.COM	35103-6091838-1	92-320-7371771	92-302-4642811	Dholan Chak 07	I.Com	Male		29-Sep-2025	Fresh
64	16-Aug-2025	Umair Waqas	ON Site			umair.waqas@hostajournal.biz	alialso1823@gmail.com	35103-3782135-9	92-327-0043093	92-306-4216778	Zahid Housing Scheme, Pattoki		Male		5-Oct-2025	Fresh
65	5-Nov-2025	Hifza Rafique	ON Site		Sent CFP + Submission Check + Emails Inbox	"hifzarafique12@gmail.com
Hifza1020
PC name 10
PC pswrd:P@kistan123"	hifzamam@gmail.com	35101-1723527-6	92-344-0147180	92-302-6808184	Kashif Chok Pattoki Near Barkat-e-Mustafa	BS Chemistry	Female	🔑		Fresh
66	11-Nov-2025	Anisa Aslam	ON Site		Indexing	"anisaaslam678@gmail.com
an1sa#star!786"		35103-4427263-8	92-316-6628720	92-300-4146627	Gulshan Subhan Near Dar-e-Arkam School Pattoki	FSC-Medical	Female		13-Nov-2025	Fresh
67	11-Nov-2025	Raheen Shahbaz	ON Site		Citation + 	"raheenshahbaz6@g.mail.com
Password:R@h15reen"	raheenshahbaz647@gmail.com	35103-5009720-0	92-319-4511647	92-303-0402187	Ghalan Chak no:9	FSC-Engineering	Female	🔑		Fresh
68	11-Nov-2025	Ayesha Tariq	ON Site		Groups + Submission + Artcile Publication + Issue Publish	"ayeshatariq8836@gmail.com
password : aisha8836
PC name 5 
PC pswrd:ayesha123"	ayeshatariq88991@gmail.com	35101-7677255-4	92-309-4988991	92-300-8836553	Changa Manga Bank Street House no:139	BS-English	Female			Navttc Jamber (HR Assistant) 6 Months
69	11-Nov-2025	Hira Kahdim	ON Site		Indexing + Citation	"hirakhdim9272@gmail.com 
Pswrd:Hi9244r@
PC name Hira 
PC pswrd:hira@123"	"hirakhdim9272@gmail.com 
"	35103-4222683-0	92-306-9548415	92-321-7951663	Kashif Chok Pattoki Near Jamia Majid Shah Jmat	"Intermediate F.A
Computer Diploma From GVTIW Pattoki"	Female			
70	30-Dec-2025	Alia Sagheer	ON Site		Formatting + Uplaoding	"Sabasagheer552@gmail.com
Password: @676767#"	sabasagheer00@gmail.com	35103-3320904-6	92-311-1658519	92-308-4365319	Bismillah City, Hallah Road Pattoki	"I.COM
1 year IT Diploma"	Female			1.5 year teaching in Brilliant School, Hallah Road Pattoki
71	30-Dec-2025	Saba Sagheer	ON Site		Old > New + 	"Sabasagheer552@gmail.com
Password: @676767#"	sabasagheer00@gmail.com	35103-6450679-6	92-311-1658520	92-308-4365320	Bismillah City, Hallah Road Pattoki	FSC (Pre-Eng)	Female			1.5 year teaching in Brilliant School, Hallah Road Pattoki
72	28-Jan-2026	Samana Batool	ON Site		CFP	"batoolsamana437@gmail.com
S@0mb321"	samanab998@gmail.com	35103-5959324-0	92-308-2310465	92-303-4033359	Pattoki Bilal Colony	ICS , BBA Continue University Of Okara	Female			Fresh
73	4-Feb-2026	Amina Mumtaz	ON Site		DOAJ / SCOPUS / WOS Publication		iaminamumtaz2002@gmail.com	35101-4487049-6	92-310-6301496	92-303-4069327	Gulshan Subhan Phase 1 Pattoki	"BS-Education 
Mphil-Education Continue"	Female			Fresh
74	8-Feb-2026	Areeba Shahzad	ON Site			"

areebashahzad200@gmail.com 
Password:@reeb200@"	areebashahzad899@gmail.com	35101-2640220-6	92-334-6437100	92-335-6437100	Anwar Colony Near Kareem Park Mega Road	ICS , BBA Continue University Of Okara	Female			Fresh
75	14-Feb-2026	Mehmona Mehmood	ON Site	Accounts			maimoonamahmood09@gmail.com	90403-0144555-4	92-307-8832530	92-308-4074571	Bilal Colony Pattoki	ICOM,ADP Accounting & Finance	Female			Fresh
76	8-Feb-2026	Amina Afzal	ON Site										Female			
77	15-Feb-2026	Muqadas  Maid	ON Site					35103-7773414-8								"""

lines = data.strip().split('\n')
employees = []

for line in lines:
    # Handle quoted strings with newlines
    # This is tricky with simple split. Let's try regex or a more robust parser.
    # Actually, the quotes seem to be around emails/passwords.
    
    # Simple tab split for now, but need to handle the quoted parts.
    # Let's use a regex to find tabs not inside quotes.
    parts = re.split(r'\t', line)
    
    if len(parts) < 3:
        continue
        
    emp = {
        "employeeId": parts[0].strip(),
        "joiningDate": parts[1].strip(),
        "name": parts[2].strip(),
        "modeOfWorking": parts[3].strip() if len(parts) > 3 else "",
        "department": parts[4].strip() if len(parts) > 4 else "",
        "assignments": parts[5].strip() if len(parts) > 5 else "",
        "officialMail": parts[6].strip().replace('"', '') if len(parts) > 6 else "",
        "personalEmail": parts[7].strip() if len(parts) > 7 else "",
        "cnic": parts[8].strip() if len(parts) > 8 else "",
        "whatsappPersonal": parts[9].strip() if len(parts) > 9 else "",
        "homePhone": parts[10].strip() if len(parts) > 10 else "",
        "address": parts[11].strip() if len(parts) > 11 else "",
        "qualification": parts[12].strip() if len(parts) > 12 else "",
        "gender": parts[13].strip() if len(parts) > 13 else "Male",
        "remarks": parts[14].strip() if len(parts) > 14 else "",
        "endingDate": parts[15].strip() if len(parts) > 15 else "",
        "experience": parts[16].strip() if len(parts) > 16 else "",
        "role": "Employee",
        "points": 0,
        "email": parts[7].strip() if len(parts) > 7 and parts[7].strip() else f"emp{parts[0].strip()}@hostajournal.biz",
        "createdAt": "2024-01-01T00:00:00Z" # Placeholder
    }
    
    # Fix gender
    if emp["gender"] not in ["Male", "Female", "Other"]:
        emp["gender"] = "Male"
        
    employees.append(emp)

with open('employees.json', 'w') as f:
    json.dump(employees, f, indent=2)
