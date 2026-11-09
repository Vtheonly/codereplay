import subprocess
import sys

SCRIPTS = [
    "TP1/TP1_Exo2.py",
    "TP1/TP1_Exo3.py",
    "TP1/TP1_Exo4.py",
    "TP1/TP1_Exo5.py",
    "TP2/TP2_Exo1.py",
    "TP2/TP2_Exo2.py",
    "TP2/TP2_Exo3.py",
    "TP2/TP2_Exo4.py",
    "TP2/TP2_Exo5.py",
    "TP2/TP2_Exo6.py",
    "TP3/TP3_Exo1.py",
    "TP3/TP3_Exo2.py",
    "TP3/TP3_Exo3.py",
]

print("=" * 60)
print("EXECUTING FULL CODEBASE VERIFICATION SUITE")
print("=" * 60)

for s in SCRIPTS:
    print(f"[*] Running {s}...")
    res = subprocess.run([sys.executable, s], capture_output=False)
    if res.returncode != 0:
        print(f"[!] FAILED: {s}")
        sys.exit(res.returncode)
    print(f"[✓] PASSED: {s}\n")
