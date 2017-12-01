#include <math.h>

int TimeBetweenReadings = 500;
int ReadingNumber=0;

const int muxLSB = 10;
const int muxMSB = 11;

void setMux(int connectorNum)
{ 
// void setMux(int connectorNum)
// connectorNum is a number from 0 to 3 which
// identifies which connector to switch the MUX to.
// Where if connector num is equal to:
//    0 --> Analog 1
//    1 --> Analog 2
//    2 --> Digital 1
//    3 --> Digital 2

  switch (connectorNum)
  {
  case 1: // ANALOG 2 - MUX ADDR 01
    digitalWrite(muxMSB, LOW);
    digitalWrite(muxLSB, HIGH);
    break;
  case 2: // DIGITAL 1 - MUX ADDR 10 
    digitalWrite(muxMSB, HIGH);
    digitalWrite(muxLSB, LOW);
    break;
  case 3: // DIGITAL 2 - MUX ADDR 11
    digitalWrite(muxMSB, HIGH);
    digitalWrite(muxLSB, HIGH);
    break;
  default: // ANALOG 1 - MUX ADDR 00
    digitalWrite(muxMSB, LOW);
    digitalWrite(muxLSB, LOW);
  }
}

void setup() {
  // initialize serial communication at 9600 bits per second:
  Serial.begin(57600);

  pinMode(muxLSB, OUTPUT);
  pinMode(muxMSB, OUTPUT);
}
void loop() {
  
  if (ReadingNumber % 2 == 0) {
    setMux(0);
    readAmmonium();
  } else {
    setMux(1);
    readNitrate();
  }

  ReadingNumber++;
  delay(TimeBetweenReadings);
}

void readAmmonium() {

  float count = analogRead(A0);

  String id = "INF_NH4";

  String output = id + "#" + count;
  
  Serial.println(output);
}

void readNitrate() {
  
  float count = analogRead(A2);

  String id = "INF_NO3";

  String output = id + "#" + count;
  
  Serial.println(output);
}
