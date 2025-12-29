import argparse
import csv
import os
import sys

import pandas as pd
from jinja2 import Environment, FileSystemLoader

parser = argparse.ArgumentParser()
parser.add_argument("-f", "--file", help="xlsx name - ex. edge_info.xlsx")
args = parser.parse_args()
file = args.file

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

template = env.get_template("service-template.txt")

df = pd.read_excel(dev_inv_file)
df.to_csv("temp.csv", index=False)

with open("temp.csv") as f:
    routers = csv.DictReader(f)
    for router in routers:
        # r1_conf = "./configs/" + router["name"] + ".service"
        r1_conf = router["name"] + ".service"
        with open(r1_conf, "w") as f:
            f.write(template.render(router))


#    print(routers)
#    print(routers.columns)
#    print(routers['hostname'])
#    list1 = routers['hostname']

#    for router in routers:
#        print(list1[i])
#        r1_conf = './configs/' + list1[i] + '-1.txt'
#        i += 1
#        with open(r1_conf, 'w') as f:
#            f.write(template.render(router))
