int count = 0;

void setup() 
{
  Serial.begin(57600);
}

void loop() 
{  
  count++;
  String id = count % 2 == 0 ? "Sensor-3" : "Sensor-5";
  int data = random(100);
  String output =  id + "#" + data;
  Serial.println(output);
  delay(3000);        
}
