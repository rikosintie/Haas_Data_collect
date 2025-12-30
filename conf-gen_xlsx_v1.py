import argparse
import csv
import os
import sys

import pandas as pd
from jinja2 import Environment, FileSystemLoader

parser = argparse.ArgumentParser()
parser.add_argument("-f", "--file", help="xlsx name - ex. machines.xlsx")
parser.add_argument("-t", "--template", help="template name - ex. service-template.txt")
args = parser.parse_args()
file = args.file
template_name = args.template

if file is None:
    print("-f file name is a required argument")
    sys.exit()
else:
    dev_inv_file = file

# check if csv file exists
if not os.path.isfile(dev_inv_file):
    print("{} doesn't exist ".format(dev_inv_file))
    sys.exit()
path1 = "."
isExist = os.path.exists(path1)


env = Environment(loader=FileSystemLoader(path1))

# template = env.get_template("service-template.txt")
template = env.get_template(template_name)

df = pd.read_excel(dev_inv_file)
df.to_csv("temp.csv", index=False)

with open("temp.csv") as f:
    routers = csv.DictReader(f)
    for router in routers:
        if template_name == "service-template.txt":
            # r1_conf = "./configs/" + router["name"] + ".service"
            r1_conf = router["name"] + ".service"
        elif template_name == "systemd-template.txt":
            r1_conf = router["name"] + ".txt"
        with open(r1_conf, "w") as f:
            f.write(template.render(router))
