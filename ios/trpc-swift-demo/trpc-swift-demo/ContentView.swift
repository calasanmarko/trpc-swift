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
                doQuery()
            } label: {
                Text("Test")
            }
        }
        .padding()
        .onAppear {
            doQuery()
        }
    }
    
    func doQuery() {
        Task {
            print(try! await AppClient.Layer.Depth().three(input: .init(name: "Wooo", other: [.init(nest: 3, bro: .init(), arr: ["AAA"], arr2: ["BBB"])])))
            print(try! await AppClient.Layer.Depth().four(input: .init(name: "Test"))!)
        }
    }
}

#Preview {
    ContentView()
}
