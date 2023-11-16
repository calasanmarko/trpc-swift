//
//  ContentView.swift
//  trpc-swift-demo
//
//  Created by Marko on 11/16/23.
//

import SwiftUI

struct ContentView: View {
    let app = AppClient(baseUrl: URL(string: "http://localhost:5050/trpc")!)
    
    var body: some View {
        VStack {
            Button {
                Task {
                    print(try! await AppClient.Layer.Depth().four(input: .init(name: "Test"))!)
                }
            } label: {
                Text("Test")
            }
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
