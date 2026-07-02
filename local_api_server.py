import json
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

# Local file database to store history logs
DB_FILE = 'local_db.json'

# Initial baseline data
DEFAULT_HISTORY = [
  {
    "StackName": "ProductionCoreStack",
    "Timestamp": datetime.utcnow().isoformat() + 'Z',
    "Status": "IN_SYNC",
    "CheckType": "SCHEDULED",
    "FriendlySummary": "No drift detected. Your infrastructure matches the CloudFormation template.",
    "Drifts": []
  }
]

def load_db():
    try:
        with open(DB_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        with open(DB_FILE, 'w') as f:
            json.dump(DEFAULT_HISTORY, f, indent=2)
        return DEFAULT_HISTORY

def save_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=2)

class DriftApiHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        # CORS Headers to allow React Dashboard to fetch
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token')
        self.end_headers()

    def do_OPTIONS(self):
        # Handle CORS preflight request
        self._set_headers(200)

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        
        if path == '/history':
            history = load_db()
            response_data = {
                'count': len(history),
                'history': history
            }
            self._set_headers(200)
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Not Found'}).encode('utf-8'))

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        
        if path == '/check':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            body = json.loads(post_data.decode('utf-8'))
            
            stack_name = body.get('stack_name', 'ProductionCoreStack')
            print(f"Triggering check request for stack: {stack_name}")
            
            # Load current history
            history = load_db()
            
            # Determine status: Alternate drift to simulate real changes!
            is_currently_drifted = len(history) > 0 and history[0]['Status'] == 'DRIFTED'
            
            if is_currently_drifted:
                # Resolve drift back to In Sync
                new_entry = {
                    "StackName": stack_name,
                    "Timestamp": datetime.utcnow().isoformat() + 'Z',
                    "Status": "IN_SYNC",
                    "CheckType": "MANUAL",
                    "FriendlySummary": "No drift detected. Your infrastructure matches the CloudFormation template.",
                    "Drifts": []
                }
                print("Simulating drift resolved (IN_SYNC).")
            else:
                # Create a simulated drift event
                new_entry = {
                    "StackName": stack_name,
                    "Timestamp": datetime.utcnow().isoformat() + 'Z',
                    "Status": "DRIFTED",
                    "CheckType": "MANUAL",
                    "FriendlySummary": "Security Group WebServerSecurityGroup (sg-0abc123d45ef67890) was MODIFIED: Ingress rule added to allow public SSH traffic (Port 22) from anywhere (0.0.0.0/0) which creates a security exposure.",
                    "Drifts": [
                        {
                            "ResourceType": "AWS::EC2::SecurityGroup",
                            "LogicalResourceId": "WebServerSecurityGroup",
                            "PhysicalResourceId": "sg-0abc123d45ef67890",
                            "StackResourceDriftStatus": "MODIFIED",
                            "PropertyDifferences": [
                                {
                                  "PropertyPath": "/SecurityGroupIngress/1",
                                  "DifferenceType": "ADD",
                                  "ExpectedValue": "None",
                                  "ActualValue": '{"IpProtocol": "tcp", "FromPort": 22, "ToPort": 22, "CidrIp": "0.0.0.0/0"}'
                                }
                            ]
                        }
                    ]
                }
                print("Simulating drift detected (DRIFTED).")
                
            # Prepend new entry to database
            history.insert(0, new_entry)
            save_db(history)
            
            self._set_headers(200)
            self.wfile.write(json.dumps(new_entry).encode('utf-8'))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Not Found'}).encode('utf-8'))

def run(port=8080):
    server_address = ('', port)
    httpd = HTTPServer(server_address, DriftApiHandler)
    print(f"--- LOCAL API SERVER RUNNING ON http://localhost:{port} ---")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping local server...")
        httpd.server_close()

if __name__ == '__main__':
    run()
