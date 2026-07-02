export const MOCK_DRIFT_HISTORY = [
  {
    "StackName": "ProductionCoreStack",
    "Timestamp": new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    "Status": "DRIFTED",
    "CheckType": "SCHEDULED",
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
  },
  {
    "StackName": "ProductionCoreStack",
    "Timestamp": new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    "Status": "IN_SYNC",
    "CheckType": "SCHEDULED",
    "FriendlySummary": "No drift detected. Your infrastructure matches the CloudFormation template.",
    "Drifts": []
  },
  {
    "StackName": "ProductionCoreStack",
    "Timestamp": new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    "Status": "DRIFTED",
    "CheckType": "MANUAL",
    "FriendlySummary": "EC2 Instance AppServerInstance (i-0123456789abcdef0) was MODIFIED: InstanceType upgraded from t3.micro to t3.large, increasing capacity and resource cost.",
    "Drifts": [
      {
        "ResourceType": "AWS::EC2::Instance",
        "LogicalResourceId": "AppServerInstance",
        "PhysicalResourceId": "i-0123456789abcdef0",
        "StackResourceDriftStatus": "MODIFIED",
        "PropertyDifferences": [
          {
            "PropertyPath": "/InstanceType",
            "DifferenceType": "MODIFY",
            "ExpectedValue": "t3.micro",
            "ActualValue": "t3.large"
          }
        ]
      }
    ]
  },
  {
    "StackName": "ProductionCoreStack",
    "Timestamp": new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
    "Status": "IN_SYNC",
    "CheckType": "SCHEDULED",
    "FriendlySummary": "No drift detected. Your infrastructure matches the CloudFormation template.",
    "Drifts": []
  }
];

export const MOCK_NEW_DRIFT = {
  "StackName": "ProductionCoreStack",
  "Timestamp": new Date().toISOString(),
  "Status": "DRIFTED",
  "CheckType": "MANUAL",
  "FriendlySummary": "S3 Bucket StorageBucket (production-assets-98231) was MODIFIED: PublicAccessBlockConfiguration removed, making the bucket vulnerable to public read exposure.",
  "Drifts": [
    {
      "ResourceType": "AWS::S3::Bucket",
      "LogicalResourceId": "StorageBucket",
      "PhysicalResourceId": "production-assets-98231",
      "StackResourceDriftStatus": "MODIFIED",
      "PropertyDifferences": [
        {
          "PropertyPath": "/PublicAccessBlockConfiguration/BlockPublicAcls",
          "DifferenceType": "REMOVE",
          "ExpectedValue": "true",
          "ActualValue": "false"
        },
        {
          "PropertyPath": "/PublicAccessBlockConfiguration/RestrictPublicBuckets",
          "DifferenceType": "REMOVE",
          "ExpectedValue": "true",
          "ActualValue": "false"
        }
      ]
    }
  ]
};
